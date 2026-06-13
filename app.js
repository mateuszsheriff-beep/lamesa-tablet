// ==========================================
// KONFIGURACJA SUPABASE (Pamiętaj o podmianie!)
// ==========================================
const supabaseUrl = 'TWOJ_URL_SUPABASE'; 
const supabaseKey = 'TWOJ_KLUCZ_ANON';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let CurrentUser = null;

document.addEventListener("DOMContentLoaded", () => {
    setupLogin();
    setupNavigation();
    setupReceipts();
    setupInvoiceToggle();
    setupWarehouse();     // PRZYWRÓCONE
    setupAvatarUpload();  // PRZYWRÓCONE
    
    const savedUser = localStorage.getItem('mdt_user');
    if (savedUser) {
        try {
            CurrentUser = JSON.parse(savedUser);
            loginSuccess();
        } catch (e) {
            localStorage.removeItem('mdt_user');
        }
    }
});

// ==========================================
// LOGOWANIE
// ==========================================
function setupLogin() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullname = document.getElementById('login-fullname').value.trim();
        
        CurrentUser = { fullname: fullname, role: 'Pracownik' };
        localStorage.setItem('mdt_user', JSON.stringify(CurrentUser));
        loginSuccess();
    });
}

function loginSuccess() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    
    document.getElementById('sidebar-username').innerText = CurrentUser.fullname;
    document.getElementById('sidebar-role').innerText = CurrentUser.role;

    // Ładowanie zapisanego awatara
    const savedAvatar = localStorage.getItem(`avatar_${CurrentUser.fullname}`);
    if (savedAvatar) {
        document.getElementById('profile-avatar').src = savedAvatar;
        document.getElementById('profile-avatar').classList.remove('hidden');
    }

    fetchReceipts();
    fetchUserStats();
    fetchWarehouse(); // Ładowanie magazynu
}

window.logout = function() {
    CurrentUser = null;
    localStorage.removeItem('mdt_user');
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
}

// ==========================================
// NAWIGACJA
// ==========================================
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => {
                b.classList.remove('bg-gray-800/50', 'text-amber-500', 'border', 'border-gray-700');
                b.classList.add('text-gray-400');
            });
            btn.classList.add('bg-gray-800/50', 'text-amber-500', 'border', 'border-gray-700');
            btn.classList.remove('text-gray-400');

            tabContents.forEach(tab => tab.classList.add('hidden'));
            const targetTab = document.getElementById(btn.getAttribute('data-tab'));
            if (targetTab) targetTab.classList.remove('hidden');
        });
    });
}

// ==========================================
// AWATAR (Przywrócone)
// ==========================================
function setupAvatarUpload() {
    const avatarInput = document.getElementById('avatar-upload');
    const avatarImg = document.getElementById('profile-avatar');

    if(!avatarInput) return;

    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && CurrentUser) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const base64String = event.target.result;
                avatarImg.src = base64String;
                avatarImg.classList.remove('hidden');
                localStorage.setItem(`avatar_${CurrentUser.fullname}`, base64String);
            };
            reader.readAsDataURL(file);
        }
    });
}

// ==========================================
// KASA & PARAGONY
// ==========================================
function setupInvoiceToggle() {
    const docTypeSelect = document.getElementById("receipt-doc-type");
    const invoiceBlock = document.getElementById("invoice-details-block");
    const invoiceInput = document.getElementById("receipt-invoice-data");

    if(!docTypeSelect) return;

    docTypeSelect.addEventListener("change", () => {
        if (docTypeSelect.value === "Faktura") {
            invoiceBlock.classList.remove("hidden");
            invoiceInput.required = true;
        } else {
            invoiceBlock.classList.add("hidden");
            invoiceInput.required = false;
            invoiceInput.value = "";
        }
    });
}

function setupReceipts() {
    const form = document.getElementById("receipt-form");
    const btn = document.getElementById("receipt-btn");
    const dishSelect = document.getElementById("receipt-dish-select");
    const customBlock = document.getElementById("custom-dish-block");

    if (!form) return;

    dishSelect.addEventListener("change", () => {
        if (dishSelect.value === "CUSTOM") {
            customBlock.classList.remove("hidden");
            document.getElementById("receipt-custom-products").required = true;
        } else {
            customBlock.classList.add("hidden");
            document.getElementById("receipt-custom-products").required = false;
        }
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const amount = parseInt(document.getElementById("receipt-amount").value, 10);
        if (isNaN(amount) || amount <= 0) { alert("Wprowadź poprawną kwotę!"); return; }

        btn.disabled = true;
        btn.innerText = "Zapisywanie...";

        const clientDiscord = document.getElementById("receipt-discord").value.trim();
        const paymentMethod = document.getElementById("receipt-payment").value;
        const docType = document.getElementById("receipt-doc-type").value;
        const invoiceData = document.getElementById("receipt-invoice-data").value.trim();
        
        let finalProduct = dishSelect.value === "CUSTOM" ? document.getElementById("receipt-custom-products").value.trim() : dishSelect.value;
        if (!finalProduct) { alert("Wybierz danie!"); btn.disabled = false; return; }

        try {
            const { error } = await supabaseClient.from('cartel_paragony').insert([{ 
                seller_name: CurrentUser.fullname, 
                client_discord: clientDiscord, 
                products: finalProduct, 
                amount: amount,
                payment_method: paymentMethod,
                document_type: docType,
                invoice_details: docType === "Faktura" ? invoiceData : null
            }]);

            if (error) throw error;
            
            alert(`Zapisano pomyślnie ${docType}!`);
            form.reset();
            customBlock.classList.add("hidden");
            document.getElementById("invoice-details-block").classList.add("hidden");
            
            fetchReceipts();
            fetchUserStats(); 
        } catch (err) {
            alert("Błąd zapisu: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "Zapisz w księgach";
        }
    });
}

window.fetchReceipts = async function() {
    const container = document.getElementById("receipts-list");
    if (!container) return;

    try {
        const { data, error } = await supabaseClient.from('cartel_paragony').select('*').order('created_at', { ascending: false }).limit(30);
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500 text-center p-4">Brak zarejestrowanych transakcji.</p>';
            return;
        }

        container.innerHTML = data.map(item => {
            let dateDisplay = "";
            if (item.created_at) {
                const d = new Date(item.created_at);
                if (!isNaN(d.getTime())) dateDisplay = ` | 🕒 ${d.toLocaleDateString('pl-PL')} ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
            }

            const isInvoice = item.document_type === "Faktura";
            const docBadge = isInvoice 
                ? `<span class="bg-blue-900/40 text-blue-400 border border-blue-700 px-1.5 py-0.5 rounded text-[10px] ml-2 uppercase">📄 Faktura</span>` 
                : `<span class="bg-gray-800 text-gray-300 border border-gray-600 px-1.5 py-0.5 rounded text-[10px] ml-2 uppercase">🧾 Paragon</span>`;
            
            let payIcon = "💵";
            if(item.payment_method === "Karta") payIcon = "💳";
            if(item.payment_method === "Przelew") payIcon = "🏦";

            const invoiceDetailsHtml = isInvoice && item.invoice_details 
                ? `<div class="mt-1.5 bg-[#0b0c10] border border-blue-900/30 p-2 rounded text-[10px] text-gray-400"><span class="text-blue-500 font-semibold">Dane nabywcy:</span> ${item.invoice_details}</div>` : '';

            return `
            <div class="bg-[#11141a] p-3 rounded-lg mb-2 border ${isInvoice ? 'border-blue-900/30' : 'border-gray-800'} text-xs flex justify-between items-center">
                <div class="flex-1">
                    <p class="font-bold text-amber-400 mb-0.5 flex items-center">${item.products} ${docBadge}</p>
                    <p class="text-gray-500">Sprzedawca: <span class="text-gray-300">${item.seller_name}</span> | Klient: <span class="text-amber-500/70">@${item.client_discord}</span> <span class="text-gray-600 font-mono">${dateDisplay}</span></p>
                    ${invoiceDetailsHtml}
                </div>
                <div class="text-right ml-4">
                    <div class="font-mono font-bold text-green-400 text-sm">$${item.amount.toLocaleString()}</div>
                    <div class="text-[10px] text-gray-500 mt-1" title="Metoda płatności: ${item.payment_method}">${payIcon} ${item.payment_method || 'Gotówka'}</div>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p class="text-xs text-red-400 p-2">Błąd ładowania: ${err.message}</p>`;
    }
};

window.fetchUserStats = async function() {
    const countDisplay = document.getElementById("user-receipt-count");
    if (!countDisplay || !CurrentUser) return;

    try {
        const { count, error } = await supabaseClient.from('cartel_paragony').select('*', { count: 'exact', head: true }).eq('seller_name', CurrentUser.fullname);
        if (error) throw error;
        countDisplay.innerText = count || 0;
    } catch (err) {
        console.error("Błąd ładowania statystyk:", err);
        countDisplay.innerText = "Err";
    }
};

// ==========================================
// MAGAZYN (Przywrócone)
// ==========================================
function setupWarehouse() {
    const form = document.getElementById("warehouse-form");
    const btn = document.getElementById("warehouse-btn");

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        btn.disabled = true;
        btn.innerText = "Zapisywanie...";

        const item = document.getElementById("warehouse-item").value.trim();
        const amount = document.getElementById("warehouse-amount").value;
        const receiver = document.getElementById("warehouse-discord").value.trim();

        try {
            // Zakładam, że Twoja tabela do magazynu to 'cartel_magazyn' (jeśli nazywa się inaczej, popraw tutaj)
            const { error } = await supabaseClient.from('cartel_magazyn').insert([{ 
                issuer_name: CurrentUser.fullname, 
                item_name: item, 
                amount: amount, 
                receiver_discord: receiver 
            }]);

            if (error) throw error;
            
            alert("Pomyślnie wydano towar!");
            form.reset();
            fetchWarehouse();
        } catch (err) {
            alert("Błąd zapisu w magazynie: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "Wydaj Towar";
        }
    });
}

window.fetchWarehouse = async function() {
    const container = document.getElementById("warehouse-list");
    if (!container) return;

    try {
        // Tabela z magazynem (zmień nazwę jeśli masz inną w bazie)
        const { data, error } = await supabaseClient.from('cartel_magazyn').select('*').order('created_at', { ascending: false }).limit(30);
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500 text-center p-4">Brak wydanych towarów.</p>';
            return;
        }

        container.innerHTML = data.map(entry => {
            let dateDisplay = "";
            if (entry.created_at) {
                const d = new Date(entry.created_at);
                if (!isNaN(d.getTime())) dateDisplay = `${d.toLocaleDateString('pl-PL')} ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
            }

            return `
            <div class="bg-[#11141a] p-3 rounded-lg mb-2 border border-gray-800 text-xs">
                <div class="flex justify-between mb-1">
                    <span class="font-bold text-amber-400">${entry.item_name} (x${entry.amount})</span>
                    <span class="text-gray-500">${dateDisplay}</span>
                </div>
                <div class="text-gray-400">
                    Wydający: <span class="text-gray-200">${entry.issuer_name}</span> ➔ Odbiorca: <span class="text-amber-500/70">@${entry.receiver_discord}</span>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p class="text-xs text-red-400 p-2">Błąd ładowania: ${err.message}</p>`;
    }
};