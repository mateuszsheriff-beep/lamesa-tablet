// CONFIG_SUPABASE: Zachowaj swoje poprawne klucze!
const SUPABASE_URL = "https://azficflfpvvntuufjfne.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ZmljZmxmcHZ2bnR1dWZqZm5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzY5ODAsImV4cCI6MjA5NjE1Mjk4MH0.1YFCrNluP7IgnlXy8JUgftBiRS6XqQ8LUZP9u389p-c";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let CurrentUser = null;
let localInventory = {}; 

// STAN GLOBALNY MINIGRY KULINARNEJ
let currentGameType = null;
let currentRecipeTarget = []; 
let currentPlayerStack = [];  
let currentDbRequirements = {}; 
let isProcessingMinigame = false; 

document.addEventListener("DOMContentLoaded", () => {
    setupAuthUI();
    setupLogin();
    setupRegistration();
    setupNavigation();
    setupReceipts();
    setupWarehouse();
    setupAvatarUpload();
    setupDutyPanel(); 
});

function setupAuthUI() {
    const showRegBtn = document.getElementById("show-register-btn");
    const showLoginBtn = document.getElementById("show-login-btn");
    const loginForm = document.getElementById("login-form");
    const regForm = document.getElementById("register-form");
    const authSubtitle = document.getElementById("auth-subtitle");

    if (showRegBtn) {
        showRegBtn.addEventListener("click", () => {
            loginForm.classList.add("hidden");
            regForm.classList.remove("hidden");
            authSubtitle.innerText = "Wyślij wniosek o założenie konta";
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener("click", () => {
            regForm.classList.add("hidden");
            loginForm.classList.remove("hidden");
            authSubtitle.innerText = "Zaloguj się do systemu";
        });
    }
}

// Logowanie
function setupLogin() {
    const loginForm = document.getElementById("login-form");
    const loginBtn = document.getElementById("login-btn");

    if (!loginForm) return;

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const idInput = document.getElementById("login-id").value.trim();
        const passInput = document.getElementById("login-pass").value.trim();

        if (!idInput || !passInput) {
            alert("Uzupełnij wszystkie pola logowania!");
            return;
        }

        loginBtn.innerText = "Sprawdzanie...";
        loginBtn.disabled = true;

        try {
            if (idInput === "001" && passInput === "zarzad") {
                CurrentUser = { badge: "001", fullname: "Zarząd", rank: "Szef (Zarząd)", discord: "szef_rp", is_admin: true, avatar_url: null };
                loginSuccess();
                return;
            }

            const { data, error } = await supabaseClient
                .from('cartel_users')
                .select('*')
                .eq('badge', idInput)
                .eq('password', passInput)
                .single();

            if (error || !data) {
                alert("Błędny ID lub Hasło! Albo baza uważa, że takie konto nie istnieje.");
                return;
            }

            if (data.is_approved === false) {
                alert("Twoje konto wciąż czeka na akceptację przez Zarząd!");
                return;
            }

            CurrentUser = { 
                ...data, 
                is_admin: (data.rank.toLowerCase().includes('zarząd') || data.rank.toLowerCase().includes('szef')) 
            };
            loginSuccess();

        } catch (error) {
            console.error("Błąd logowania:", error);
        } finally {
            loginBtn.innerText = "Autoryzuj dostęp";
            loginBtn.disabled = false;
        }
    });

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            document.getElementById("main-app").classList.add("hidden");
            document.getElementById("login-screen").classList.remove("hidden");
            document.getElementById("login-pass").value = "";
            CurrentUser = null;
        });
    }
}

function loginSuccess() {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("main-app").classList.remove("hidden");
    
    document.getElementById("side-user-name").innerText = CurrentUser.fullname;
    document.getElementById("side-user-rank").innerText = CurrentUser.rank;
    document.getElementById("user-fullname").innerText = CurrentUser.fullname;
    document.getElementById("user-badge").innerText = CurrentUser.badge;
    document.getElementById("user-discord").innerText = CurrentUser.discord;

    const defaultAvatar = "https://i.pravatar.cc/150?img=11";
    document.getElementById("side-user-avatar").src = CurrentUser.avatar_url || defaultAvatar;
    document.getElementById("main-user-avatar").src = CurrentUser.avatar_url || defaultAvatar;

    if (CurrentUser.is_admin) {
        document.getElementById("nav-admin").classList.remove("hidden");
        const adminPanel = document.getElementById("admin-warehouse-panel");
        if(adminPanel) adminPanel.classList.remove("hidden");
        fetchPendingUsers();
    } else {
        document.getElementById("nav-admin").classList.add("hidden");
        const adminPanel = document.getElementById("admin-warehouse-panel");
        if(adminPanel) adminPanel.classList.add("hidden");
    }

    fetchReceipts();
    fetchInventory();
    fetchActivityStats(); 
}

// Rejestracja
function setupRegistration() {
    const regForm = document.getElementById("register-form");
    const regBtn = document.getElementById("register-btn");

    if (!regForm) return;

    regForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        regBtn.innerText = "Wysyłanie...";
        regBtn.disabled = true;

        const name = document.getElementById("reg-name").value.trim();
        const badge = document.getElementById("reg-id").value.trim();
        const discord = document.getElementById("reg-discord").value.trim();
        const pass = document.getElementById("reg-pass").value.trim();

        try {
            const { error } = await supabaseClient.from('cartel_users').insert([
                { badge: badge, password: pass, fullname: name, discord: discord, is_approved: false, rank: "Praktykant" }
            ]);

            if (error) throw error;
            
            alert("Wniosek wysłany! Poczekaj, aż Zarząd zaakceptuje Twoje konto.");
            document.getElementById("show-login-btn").click();
            regForm.reset();
        } catch (err) {
            alert("Błąd rejestracji: " + err.message);
        } finally {
            regBtn.innerText = "Wyślij wniosek do zarządu";
            regBtn.disabled = false;
        }
    });
}

// Nawigacja
function setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    navButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            navButtons.forEach(b => { b.classList.remove("nav-active"); b.classList.add("nav-inactive"); });
            btn.classList.add("nav-active"); btn.classList.remove("nav-inactive");
            tabContents.forEach(tab => tab.classList.add("hidden"));
            
            const targetTab = document.getElementById(btn.getAttribute("data-tab"));
            if (targetTab) targetTab.classList.remove("hidden");
        });
    });
}

// Wgrywanie zdjęć profilowych
function setupAvatarUpload() {
    const avatarInput = document.getElementById("avatar-input");
    if (!avatarInput) return;
    
    avatarInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 1500000) {
            alert("Zdjęcie jest za duże! Maksymalny rozmiar to 1.5 MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result;

            if (CurrentUser.badge === "001") {
                document.getElementById("side-user-avatar").src = base64String;
                document.getElementById("main-user-avatar").src = base64String;
                alert("Zmieniono tymczasowy awatar Szefa.");
                return;
            }

            const { error } = await supabaseClient
                .from('cartel_users')
                .update({ avatar_url: base64String })
                .eq('badge', CurrentUser.badge);

            if (error) {
                alert("Nie udało się zapisać zdjęcia w bazie: " + error.message);
            } else {
                CurrentUser.avatar_url = base64String;
                document.getElementById("side-user-avatar").src = base64String;
                document.getElementById("main-user-avatar").src = base64String;
                alert("Twoje zdjęcie profilowe zostało zaktualizowane!");
            }
        };
        reader.readAsDataURL(file);
    });
}

// Paragony, Faktury & Kalkulator Kasy
function setupReceipts() {
    const form = document.getElementById("receipt-form");
    const btn = document.getElementById("receipt-btn");
    const dishSelect = document.getElementById("receipt-dish-select");
    const customBlock = document.getElementById("custom-dish-block");
    const docTypeSelect = document.getElementById('receipt-doc-type');
    const invoiceBlock = document.getElementById('invoice-data-block');
    const invoiceInput = document.getElementById('receipt-invoice-data');
    
    // Pola kalkulatora reszty
    const amountInputNode = document.getElementById("receipt-amount");
    const givenInputNode = document.getElementById("receipt-given");
    const changeInputNode = document.getElementById("receipt-change");

    if (!form) return;

    // Kalkulator wpłaty i reszty (działa w czasie rzeczywistym)
    function calculateChange() {
        if (!amountInputNode || !givenInputNode || !changeInputNode) return;
        
        const total = parseInt(amountInputNode.value, 10) || 0;
        const given = parseInt(givenInputNode.value, 10) || 0;
        
        if (given > 0 && given >= total && total > 0) {
            const change = given - total;
            changeInputNode.value = "$" + change.toLocaleString();
            changeInputNode.classList.remove("text-red-500");
            changeInputNode.classList.add("text-amber-500");
        } else if (given > 0 && given < total) {
            changeInputNode.value = "Za mało!";
            changeInputNode.classList.remove("text-amber-500");
            changeInputNode.classList.add("text-red-500");
        } else {
            changeInputNode.value = "$0";
            changeInputNode.classList.remove("text-red-500");
            changeInputNode.classList.add("text-amber-500");
        }
    }

    if (amountInputNode) amountInputNode.addEventListener("input", calculateChange);
    if (givenInputNode) givenInputNode.addEventListener("input", calculateChange);

    // Customowe danie
    dishSelect.addEventListener("change", () => {
        if (dishSelect.value === "CUSTOM") {
            customBlock.classList.remove("hidden");
            document.getElementById("receipt-custom-products").required = true;
        } else {
            customBlock.classList.add("hidden");
            document.getElementById("receipt-custom-products").required = false;
        }
    });

    // Faktura czy Paragon
    if(docTypeSelect) {
        docTypeSelect.addEventListener('change', function(e) {
            if (e.target.value === 'Faktura') {
                invoiceBlock.classList.remove('hidden');
                invoiceInput.required = true;
            } else {
                invoiceBlock.classList.add('hidden');
                invoiceInput.required = false;
                invoiceInput.value = ''; 
            }
        });
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const amountInput = document.getElementById("receipt-amount").value;
        const amount = parseInt(amountInput, 10);
        
        if (isNaN(amount) || amount <= 0) {
            alert("Wprowadź poprawną kwotę transakcji!");
            return;
        }

        btn.disabled = true;
        btn.innerText = "Zapisywanie...";

        const clientDiscord = document.getElementById("receipt-discord").value.trim();
        const docType = docTypeSelect ? docTypeSelect.value : 'Paragon';
        const paymentMethod = document.getElementById('receipt-payment-method') ? document.getElementById('receipt-payment-method').value : 'Gotówka';
        const invoiceData = invoiceInput ? invoiceInput.value : null;
        
        let finalProduct = "";
        if (dishSelect.value === "CUSTOM") {
            finalProduct = document.getElementById("receipt-custom-products").value.trim();
        } else if (dishSelect.value !== "") {
            finalProduct = dishSelect.value;
        } else {
            alert("Wybierz danie z listy lub zaznacz opcję własnego wpisu!");
            btn.disabled = false;
            btn.innerText = "Zapisz w księgach";
            return;
        }

        try {
            const { error } = await supabaseClient.from('cartel_paragony').insert([
                { 
                    seller_name: CurrentUser.fullname, 
                    client_discord: clientDiscord, 
                    products: finalProduct, 
                    amount: amount,
                    doc_type: docType,
                    payment_method: paymentMethod,
                    invoice_data: docType === 'Faktura' ? invoiceData : null
                }
            ]);

            if (error) throw error;
            
            alert(`Zapisano pomyślnie dokument (${docType})!`);
            form.reset();
            
            // Reset kalkulatora po wysłaniu formularza
            if (changeInputNode) {
                changeInputNode.value = "$0";
                changeInputNode.classList.remove("text-red-500");
                changeInputNode.classList.add("text-amber-500");
            }

            customBlock.classList.add("hidden");
            if(invoiceBlock) invoiceBlock.classList.add("hidden");
            fetchReceipts();
            fetchActivityStats(); 
        } catch (err) {
            alert("Błąd zapisu dokumentu: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "Zapisz w księgach";
        }
    });
}

// Pobieranie paragonów 
window.fetchReceipts = async function() {
    const container = document.getElementById("receipts-list");
    if (!container) return;

    try {
        const { data, error } = await supabaseClient
            .from('cartel_paragony')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500 text-center p-4">Brak zarejestrowanych transakcji.</p>';
            return;
        }

        container.innerHTML = data.map(item => {
            let dateString = "Brak daty";
            if (item.created_at) {
                const dateObj = new Date(item.created_at);
                dateString = dateObj.toLocaleDateString('pl-PL') + ' ' + dateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            }

            let paymentIcon = '💵';
            let pMethod = item.payment_method || 'Gotówka';
            if(pMethod === 'Karta') paymentIcon = '💳';
            else if(pMethod === 'Przelew') paymentIcon = '🏦';

            let docBadge = (item.doc_type === 'Faktura') 
                ? `<span class="bg-blue-900/40 text-blue-400 border border-blue-800/50 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">📄 Faktura: ${item.invoice_data || 'Brak NIP'}</span>`
                : `<span class="bg-gray-800 text-gray-300 border border-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">🧾 Paragon</span>`;

            return `
            <div class="bg-[#11141a] p-3 rounded-lg mb-2 border border-gray-800 flex justify-between items-center hover:bg-[#161a23] transition">
                <div>
                    <div class="flex items-center gap-2 mb-1.5">
                        <span class="text-sm font-bold text-gray-200">@${item.client_discord}</span>
                        ${docBadge}
                    </div>
                    <div class="text-[11px] text-gray-500 font-medium">
                        Towar: <span class="text-amber-500 mr-2">${item.products}</span>
                        Płatność: <span class="text-gray-300 mr-2">${paymentIcon} ${pMethod}</span>
                        <span class="text-gray-600">🕒 ${dateString}</span>
                    </div>
                    <p class="text-[10px] text-gray-600 mt-1">Wystawił: ${item.seller_name}</p>
                </div>
                <div class="text-amber-500 font-mono font-bold text-base bg-amber-500/10 px-3 py-1 rounded border border-amber-500/20">
                    $${item.amount.toLocaleString()}
                </div>
            </div>
            `;
        }).join('');

    } catch (err) {
        container.innerHTML = `<p class="text-xs text-red-400 p-2">Błąd ładowania: ${err.message}</p>`;
    }
};

// Statystyki Aktywności 
window.fetchActivityStats = async function() {
    if (!CurrentUser) return;

    try {
        const { count: totalCount, error: errTotal } = await supabaseClient
            .from('cartel_paragony')
            .select('*', { count: 'exact', head: true })
            .eq('seller_name', CurrentUser.fullname);

        const dzisiaj = new Date();
        dzisiaj.setHours(0, 0, 0, 0);

        const { count: todayCount, error: errToday } = await supabaseClient
            .from('cartel_paragony')
            .select('*', { count: 'exact', head: true })
            .eq('seller_name', CurrentUser.fullname)
            .gte('created_at', dzisiaj.toISOString());

        if (!errTotal && !errToday) {
            const elTotal = document.getElementById('activity-total-count');
            const elToday = document.getElementById('activity-today-count');
            
            if(elTotal) elTotal.innerText = totalCount || 0;
            if(elToday) elToday.innerText = todayCount || 0;
        }
    } catch (err) {
        console.error("Błąd ładowania statystyk:", err);
    }
};

// Magazyn 
function setupWarehouse() {
    const form = document.getElementById("warehouse-add-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const itemName = document.getElementById("inv-item-name").value.trim();
        const itemQtyInput = document.getElementById("inv-item-qty").value;
        const itemQty = parseInt(itemQtyInput, 10);

        if (!itemName || isNaN(itemQty)) {
            alert("Podaj prawidłową nazwę przedmiotu oraz ilość!");
            return;
        }

        try {
            const currentQty = localInventory[itemName] || 0;
            const finalQty = Math.max(0, currentQty + itemQty);

            const { error } = await supabaseClient
                .from('cartel_magazyn')
                .upsert({ item_name: itemName, quantity: finalQty }, { onConflict: 'item_name' });

            if (error) throw error;

            alert(`Zaktualizowano ${itemName}. Nowy stan: ${finalQty}`);
            form.reset();
            fetchInventory();
        } catch (err) {
            alert("Błąd magazynu: " + err.message);
        }
    });
}

window.fetchInventory = async function() {
    const container = document.getElementById("inventory-list");
    if (!container) return;

    try {
        const { data, error } = await supabaseClient.from('cartel_magazyn').select('*');
        if (error) throw error;

        localInventory = {};
        if (!data || data.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500">Magazyn jest pusty.</p>';
            return;
        }

        container.innerHTML = data.map(item => {
            localInventory[item.item_name] = item.quantity;
            const colorClass = item.quantity < 5 ? 'text-red-400 font-bold' : 'text-amber-500 font-mono';
            return `
                <div class="flex justify-between items-center bg-[#161a23] p-2 rounded border border-gray-800 text-xs">
                    <span class="text-gray-300 font-medium">📦 ${item.item_name}</span>
                    <span class="${colorClass}">${item.quantity} szt.</span>
                </div>
            `;
        }).join('');

    } catch (err) {
        container.innerHTML = `<p class="text-xs text-red-400">Błąd: ${err.message}</p>`;
    }
};

// Panel Admina
window.fetchPendingUsers = async function() {
    const container = document.getElementById("pending-users-list");
    if (!container) return;

    try {
        const { data, error } = await supabaseClient
            .from('cartel_users')
            .select('*')
            .eq('is_approved', false);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500 p-2">Brak oczekujących wniosków o utworzenie konta.</p>';
            return;
        }

        container.innerHTML = data.map(u => `
            <div class="bg-[#161a23] p-4 rounded-xl border border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                <div>
                    <p class="font-bold text-gray-200 text-sm">${u.fullname} <span class="text-amber-500 font-mono text-xs">(ID: ${u.badge})</span></p>
                    <p class="text-gray-500">Discord: @${u.discord} | Przypisywana ranga: ${u.rank}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="approveUser('${u.badge}')" class="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-black border border-green-500/30 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer">Akceptuj</button>
                    <button onclick="rejectUser('${u.badge}')" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer">Odrzuć</button>
                </div>
            </div>
        `).join('');

    } catch (err) {
        container.innerHTML = `<p class="text-xs text-red-400">Błąd listowania wniosków: ${err.message}</p>`;
    }
};

window.approveUser = async function(badgeId) {
    if (!confirm(`Czy na pewno chcesz zatwierdzić konto pracownika o ID: ${badgeId}?`)) return;
    try {
        const { error } = await supabaseClient.from('cartel_users').update({ is_approved: true }).eq('badge', badgeId);
        if (error) throw error;
        alert("Konto zostało pomyślnie aktywowane!");
        fetchPendingUsers();
    } catch (err) {
        alert("Błąd zatwierdzania: " + err.message);
    }
};

window.rejectUser = async function(badgeId) {
    if (!confirm(`Czy chcesz trwale usunąć ten wniosek o dostęp (ID: ${badgeId})?`)) return;
    try {
        const { error } = await supabaseClient.from('cartel_users').delete().eq('badge', badgeId);
        if (error) throw error;
        alert("Wniosek został odrzucony i usunięty.");
        fetchPendingUsers();
    } catch (err) {
        alert("Błąd odrzucania: " + err.message);
    }
};

// ==========================================
// LOGIKA INTERAKTYWNEJ MINIGRY KULINARNEJ
// ==========================================

window.startCookingMinigame = function(dishType) {
    if (isProcessingMinigame) return;
    
    currentGameType = dishType;
    currentPlayerStack = [];
    
    if (dishType === 'Burger') {
        currentRecipeTarget = ['Bułka', 'Mięso', 'Sałata', 'Bułka'];
        currentDbRequirements = { "Mięso": 1, "Bułka": 2 };
        document.getElementById("mg-dish-name").innerText = "Burger Klasyczny";
    } else if (dishType === 'Taco') {
        currentRecipeTarget = ['Tortilla', 'Mięso', 'Pomidor', 'Sałata'];
        currentDbRequirements = { "Mięso": 1, "Tortilla": 1, "Pomidor": 1 };
        document.getElementById("mg-dish-name").innerText = "Taco Meksykańskie";
    } else if (dishType === 'Salatka') {
        currentRecipeTarget = ['Sałata', 'Pomidor', 'Sałata'];
        currentDbRequirements = { "Sałata": 2, "Pomidor": 1 };
        document.getElementById("mg-dish-name").innerText = "Sałatka Wege";
    }

    for (const [ingredient, neededQty] of Object.entries(currentDbRequirements)) {
        const available = localInventory[ingredient] || 0;
        if (available < neededQty) {
            alert(`Błąd: W magazynie brakuje składników, by zacząć! (${ingredient}: potrzebujesz ${neededQty}, masz ${available})`);
            currentGameType = null;
            return;
        }
    }

    document.getElementById("kitchen-recipes-view").classList.add("hidden");
    document.getElementById("kitchen-minigame-view").classList.remove("hidden");

    const seqBox = document.getElementById("mg-recipe-sequence");
    seqBox.innerHTML = currentRecipeTarget.map(item => `
        <span class="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded text-[11px] font-mono">${item}</span>
    `).join('<span class="text-gray-600 px-0.5">➔</span>');

    renderPlayerPlate();
};

window.cancelCooking = function() {
    if (isProcessingMinigame) return;
    document.getElementById("kitchen-minigame-view").classList.add("hidden");
    document.getElementById("kitchen-recipes-view").classList.remove("hidden");
    currentGameType = null;
};

window.clickMinigameIngredient = async function(ingredientName) {
    if (!currentGameType || isProcessingMinigame) return;

    const currentStepIndex = currentPlayerStack.length;
    const correctStepName = currentRecipeTarget[currentStepIndex];

    if (ingredientName !== correctStepName) {
        alert("❌ Zła kolejność! Przepis zepsuty, twój blat roboczy ląduje w koszu. Zaczynasz od nowa!");
        currentPlayerStack = [];
        renderPlayerPlate();
        return;
    }

    currentPlayerStack.push(ingredientName);
    renderPlayerPlate();

    if (currentPlayerStack.length === currentRecipeTarget.length) {
        isProcessingMinigame = true; 
        
        try {
            const upsertData = Object.entries(currentDbRequirements).map(([ingredient, neededQty]) => {
                const currentQty = localInventory[ingredient] || 0;
                return {
                    item_name: ingredient,
                    quantity: Math.max(0, currentQty - neededQty)
                };
            });

            const { error } = await supabaseClient
                .from('cartel_magazyn')
                .upsert(upsertData, { onConflict: 'item_name' });

            if (error) throw error;

            alert(`🎉 Świetna robota! Potrawa została złożona idealnie i wydana z magazynu.`);
            
            document.getElementById("kitchen-minigame-view").classList.add("hidden");
            document.getElementById("kitchen-recipes-view").classList.remove("hidden");
            currentGameType = null;
            
            await fetchInventory(); 

        } catch (err) {
            alert("Błąd synchronizacji zmian z bazą: " + err.message);
        } finally {
            isProcessingMinigame = false;
        }
    }
};

function renderPlayerPlate() {
    const plate = document.getElementById("mg-player-plate");
    const emptyText = document.getElementById("plate-empty-text");

    if (!plate) return;

    if (currentPlayerStack.length === 0) {
        plate.innerHTML = '';
        if (emptyText) {
            emptyText.classList.remove("hidden");
            plate.appendChild(emptyText);
        }
    } else {
        if (emptyText) emptyText.classList.add("hidden");
        
        plate.querySelectorAll("div:not(#plate-empty-text)").forEach(el => el.remove());
        
        currentPlayerStack.forEach(item => {
            const el = document.createElement("div");
            el.className = "w-48 bg-amber-600 text-black font-bold text-xs py-1 rounded shadow text-center border border-amber-400 uppercase tracking-wider animate-bounce-short mx-auto mb-1";
            el.innerText = item;
            plate.appendChild(el);
        });
    }
}

// ==========================================
// LOGIKA PANELU SŁUŻBY (MDT)
// ==========================================
function setupDutyPanel() {
    const btnStart = document.getElementById("duty-start-btn");
    const btnBreak = document.getElementById("duty-break-btn");
    const btnEnd = document.getElementById("duty-end-btn");
    
    const statusDisplay = document.getElementById("current-duty-status");

    if (!btnStart || !btnBreak || !btnEnd) {
        console.warn("Brak przycisków służby w HTML. Sprawdź ich ID.");
        return;
    }

    btnStart.addEventListener("click", () => {
        if (!CurrentUser) {
            alert("Musisz być zalogowany, aby wejść na służbę!");
            return;
        }
        updateDutyStatus("ON-DUTY", "text-green-500");
        alert("Rozpocząłeś służbę. Powodzenia!");
    });

    btnBreak.addEventListener("click", () => {
        if (!CurrentUser) return;
        updateDutyStatus("PRZERWA", "text-amber-500");
        alert("Zszedłeś na przerwę.");
    });

    btnEnd.addEventListener("click", () => {
        if (!CurrentUser) return;
        updateDutyStatus("OFF-DUTY", "text-red-500");
        alert("Zakończyłeś służbę. Dobra robota!");
    });

    function updateDutyStatus(statusText, colorClass) {
        if (statusDisplay) {
            statusDisplay.innerText = statusText;
            statusDisplay.className = `font-bold ${colorClass}`;
        }
        console.log(`[System] Zmiana statusu pracownika ${CurrentUser?.badge}: ${statusText}`);
    }
}