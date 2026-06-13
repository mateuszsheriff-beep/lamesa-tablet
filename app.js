// ==========================================
// 1. KONFIGURACJA SUPABASE (UZUPEŁNIJ KLUCZE)
// ==========================================
const SUPABASE_URL = '"https://azficflfpvvntuufjfne.supabase.co';
const SUPABASE_ANON_KEY = 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ZmljZmxmcHZ2bnR1dWZqZm5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzY5ODAsImV4cCI6MjA5NjE1Mjk4MH0';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. STAN APLIKACJI
// ==========================================
let currentUser = null; // Przechowuje zalogowanego użytkownika

// ==========================================
// 3. INICJALIZACJA I UI
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Nawigacja - Przełączanie kart w menu bocznym
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Reset stylów przycisków
            navButtons.forEach(b => {
                b.classList.remove('nav-active');
                b.classList.add('nav-inactive');
            });
            // Aktywacja klikniętego przycisku
            btn.classList.add('nav-active');
            btn.classList.remove('nav-inactive');

            // Ukrycie wszystkich kart
            tabContents.forEach(tab => tab.classList.add('hidden'));
            
            // Pokaż wybraną kartę
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.remove('hidden');
        });
    });

    // Toggle Login/Register
    document.getElementById('show-register-btn').addEventListener('click', () => {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('auth-subtitle').innerText = "Wniosek o dostęp";
    });

    document.getElementById('show-login-btn').addEventListener('click', () => {
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('auth-subtitle').innerText = "Zaloguj się do systemu";
    });

    // Pokaż/Ukryj pole "Dane do faktury" w Kasię
    document.getElementById('receipt-doc-type').addEventListener('change', function(e) {
        const invoiceBlock = document.getElementById('invoice-data-block');
        const invoiceInput = document.getElementById('receipt-invoice-data');
        
        if (e.target.value === 'Faktura') {
            invoiceBlock.classList.remove('hidden');
            invoiceInput.required = true;
        } else {
            invoiceBlock.classList.add('hidden');
            invoiceInput.required = false;
            invoiceInput.value = ''; // Czyszczenie
        }
    });

    // Customowe danie w Kasię
    document.getElementById('receipt-dish-select').addEventListener('change', function(e) {
        const customBlock = document.getElementById('custom-dish-block');
        const customInput = document.getElementById('receipt-custom-products');
        if (e.target.value === 'CUSTOM') {
            customBlock.classList.remove('hidden');
            customInput.required = true;
        } else {
            customBlock.classList.add('hidden');
            customInput.required = false;
            customInput.value = '';
        }
    });

    // Odpięcie akcji logowania i wylogowania (na ten moment symulacja wejścia)
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Wystawianie dokumentu
    document.getElementById('receipt-form').addEventListener('submit', handleReceiptSubmit);
});

// ==========================================
// 4. LOGOWANIE (SYMULACJA / SUPABASE AUTH)
// ==========================================
async function handleLogin(e) {
    e.preventDefault();
    const loginId = document.getElementById('login-id').value;
    
    // Zastąp to docelowo prawdziwym logowaniem przez Supabase. 
    // Tymczasowo symulujemy poprawne logowanie dla celów testowych:
    currentUser = {
        id: 'user-1234', // Unikalne ID uzytkownika
        name: 'Pracownik Testowy',
        badge: loginId,
        discord: 'pracownik#0001',
        is_admin: false // Jeśli true, pokażemy tablicę zarządu
    };

    // Wypełnij dane w UI
    document.getElementById('user-fullname').innerText = currentUser.name;
    document.getElementById('side-user-name').innerText = currentUser.name;
    document.getElementById('user-badge').innerText = currentUser.badge;
    document.getElementById('user-discord').innerText = currentUser.discord;

    if (currentUser.is_admin) {
        document.getElementById('nav-admin').classList.remove('hidden');
    }

    // Przełącz widok
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    // Pobierz dane na start
    fetchReceipts();
    fetchActivityStats();
}

function handleLogout() {
    currentUser = null;
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-form').reset();
}

// ==========================================
// 5. OBSŁUGA DOKUMENTÓW (PARAGONY/FAKTURY)
// ==========================================
async function handleReceiptSubmit(e) {
    e.preventDefault();

    const discord = document.getElementById('receipt-discord').value;
    const amount = document.getElementById('receipt-amount').value;
    const docType = document.getElementById('receipt-doc-type').value;
    const paymentMethod = document.getElementById('receipt-payment-method').value;
    const invoiceData = document.getElementById('receipt-invoice-data').value;
    
    // Wyciągnięcie nazwy dania
    const dishSelect = document.getElementById('receipt-dish-select').value;
    let productName = dishSelect;
    if (dishSelect === 'CUSTOM') {
        productName = document.getElementById('receipt-custom-products').value;
    }

    // WYSYŁKA DO BAZY
    const { error } = await supabase
        .from('receipts')
        .insert([{
            user_id: currentUser.id,
            discord: discord,
            amount: parseFloat(amount),
            doc_type: docType,
            payment_method: paymentMethod,
            invoice_data: docType === 'Faktura' ? invoiceData : null,
            product_name: productName
        }]);

    if (error) {
        console.error('Błąd zapisu:', error);
        alert('Wystąpił błąd przy zapisie dokumentu w bazie.');
    } else {
        alert(`${docType} wystawiono pomyślnie!`);
        
        // Reset formularza
        document.getElementById('receipt-form').reset();
        document.getElementById('invoice-data-block').classList.add('hidden');
        document.getElementById('custom-dish-block').classList.add('hidden');

        // Odświeżenie widoków
        fetchReceipts();
        fetchActivityStats();
    }
}

// ==========================================
// 6. POBIERANIE DANYCH Z BAZY
// ==========================================
async function fetchReceipts() {
    const listDiv = document.getElementById('receipts-list');
    listDiv.innerHTML = '<p class="text-sm text-gray-500 text-center p-4">Ładowanie...</p>';

    const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        listDiv.innerHTML = '<p class="text-sm text-red-500 p-2">Błąd pobierania danych.</p>';
        console.error(error);
        return;
    }

    if (!data || data.length === 0) {
        listDiv.innerHTML = '<p class="text-sm text-gray-500 text-center p-4">Brak transakcji w bazie.</p>';
        return;
    }

    listDiv.innerHTML = '';
    data.forEach(doc => {
        // Wybór ikonki płatności
        let paymentIcon = '💵';
        if(doc.payment_method === 'Karta') paymentIcon = '💳';
        else if(doc.payment_method === 'Przelew') paymentIcon = '🏦';

        // Wybór odznaki (Paragon vs Faktura)
        let docBadge = doc.doc_type === 'Faktura' 
            ? `<span class="bg-blue-900/40 text-blue-400 border border-blue-800/50 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">📄 Faktura: ${doc.invoice_data}</span>`
            : `<span class="bg-gray-800 text-gray-300 border border-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">🧾 Paragon</span>`;

        // Format daty
        const dateObj = new Date(doc.created_at);
        const dateStr = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString()}`;

        listDiv.innerHTML += `
            <div class="bg-[#11141a] p-3 rounded-lg border border-gray-800 mb-2 flex justify-between items-center hover:bg-[#161a23] transition">
                <div>
                    <div class="flex items-center gap-2 mb-1.5">
                        <span class="text-sm font-bold text-gray-200">${doc.discord}</span>
                        ${docBadge}
                    </div>
                    <div class="text-[11px] text-gray-500 font-medium">
                        Towar: <span class="text-amber-500 mr-2">${doc.product_name || 'Brak'}</span>
                        Płatność: <span class="text-gray-300 mr-2">${paymentIcon} ${doc.payment_method}</span>
                        <span class="text-gray-600">${dateStr}</span>
                    </div>
                </div>
                <div class="text-amber-500 font-mono font-bold text-base bg-amber-500/10 px-3 py-1 rounded border border-amber-500/20">
                    $${doc.amount}
                </div>
            </div>
        `;
    });
}

async function fetchActivityStats() {
    if (!currentUser) return;

    // Pobranie ogólnej liczby dokumentów (Wszystkie) wystawionych przez pracownika
    const { count: totalCount, error: errTotal } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);

    // Pobranie liczby z DZISIAJ
    const dzisiaj = new Date();
    dzisiaj.setHours(0, 0, 0, 0); // Ustawienie od północy dzisiejszego dnia

    const { count: todayCount, error: errToday } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .gte('created_at', dzisiaj.toISOString());

    if (!errTotal && !errToday) {
        // Animacja liczników (Opcjonalnie dla lepszego efektu, ale tu wstawiamy na sztywno)
        document.getElementById('activity-total-count').innerText = totalCount || 0;
        document.getElementById('activity-today-count').innerText = todayCount || 0;
    }
}