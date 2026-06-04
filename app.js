// CONFIG_SUPABASE: Podmień poniższe dane na swoje z panelu Supabase!
const SUPABASE_URL = "https://azficflfpvvntuufjfne.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ZmljZmxmcHZ2bnR1dWZqZm5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzY5ODAsImV4cCI6MjA5NjE1Mjk4MH0.1YFCrNluP7IgnlXy8JUgftBiRS6XqQ8LUZP9u389p-c";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let CurrentUser = null;

document.addEventListener("DOMContentLoaded", () => {
    setupAuthUI();
    setupLogin();
    setupRegistration();
    setupNavigation();
    setupReceipts();
});

// Zmiana widoku Logowanie <-> Rejestracja
function setupAuthUI() {
    const showRegBtn = document.getElementById("show-register-btn");
    const showLoginBtn = document.getElementById("show-login-btn");
    const loginForm = document.getElementById("login-form");
    const regForm = document.getElementById("register-form");
    const authSubtitle = document.getElementById("auth-subtitle");

    showRegBtn.addEventListener("click", () => {
        loginForm.classList.add("hidden");
        regForm.classList.remove("hidden");
        authSubtitle.innerText = "Wyślij wniosek o założenie konta";
    });

    showLoginBtn.addEventListener("click", () => {
        regForm.classList.add("hidden");
        loginForm.classList.remove("hidden");
        authSubtitle.innerText = "Zaloguj się do systemu";
    });
}

// System Logowania
function setupLogin() {
    const loginForm = document.getElementById("login-form");
    const loginBtn = document.getElementById("login-btn");

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const idInput = document.getElementById("login-id").value.trim();
        const passInput = document.getElementById("login-pass").value.trim();

        loginBtn.innerText = "Sprawdzanie...";
        loginBtn.disabled = true;

        try {
            // Konto Zarządu - Wbudowane (Omijające bazę danych lub będące w niej)
            if (idInput === "001" && passInput === "zarzad") {
                CurrentUser = { badge: "001", fullname: "Zarząd La Mesa", rank: "El Patron (Szef)", discord: "boss_lamesa", is_admin: true };
                loginSuccess();
                return;
            }

            // Sprawdzanie kont graczy w bazie
            const { data, error } = await supabaseClient
                .from('cartel_users')
                .select('*')
                .eq('badge', idInput)
                .eq('password', passInput)
                .single();

            if (error || !data) {
                alert("Błędny ID lub Hasło! Albo baza uważa, że takie konto nie istnieje.");
                console.error("Błąd logowania DB:", error);
                return;
            }

            if (data.is_approved === false) {
                alert("Twoje konto wciąż czeka na akceptację przez Zarząd!");
                return;
            }

            // Poprawne logowanie gracza
            CurrentUser = { ...data, is_admin: false };
            loginSuccess();

        } catch (error) {
            console.error("Wystąpił nieoczekiwany błąd przy logowaniu:", error);
        } finally {
            loginBtn.innerText = "Autoryzuj dostęp";
            loginBtn.disabled = false;
        }
    });

    document.getElementById("logout-btn").addEventListener("click", () => {
        document.getElementById("main-app").classList.add("hidden");
        document.getElementById("login-screen").classList.remove("hidden");
        document.getElementById("login-pass").value = "";
        CurrentUser = null;
    });
}

function loginSuccess() {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("main-app").classList.remove("hidden");
    
    // Wypisywanie danych
    document.getElementById("side-user-name").innerText = CurrentUser.fullname;
    document.getElementById("side-user-rank").innerText = CurrentUser.rank;
    document.getElementById("user-fullname").innerText = CurrentUser.fullname;
    document.getElementById("user-badge").innerText = CurrentUser.badge;
    document.getElementById("user-discord").innerText = CurrentUser.discord;

    // Jeżeli zalogował się zarząd, pokaż zakładkę Zarządzanie
    if (CurrentUser.is_admin) {
        document.getElementById("nav-admin").classList.remove("hidden");
        fetchPendingUsers();
    } else {
        document.getElementById("nav-admin").classList.add("hidden");
    }

    // Odpalenie pobierania paragonów dla obu ról
    fetchReceipts();
}

// System Wniosków o Konto (Rejestracja)
function setupRegistration() {
    const regForm = document.getElementById("register-form");
    const regBtn = document.getElementById("register-btn");

    regForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        regBtn.innerText = "Wysyłanie...";
        regBtn.disabled = true;

        const name = document.getElementById("reg-name").value;
        const badge = document.getElementById("reg-id").value;
        const discord = document.getElementById("reg-discord").value;
        const pass = document.getElementById("reg-pass").value;

        try {
            // Dodano domyślną rangę "Rekrut" w razie gdyby baza wymagała uzupełnienia tej kolumny.
            const { error } = await supabaseClient.from('cartel_users').insert([
                { badge: badge, password: pass, fullname: name, discord: discord, is_approved: false, rank: "Rekrut" }
            ]);

            if (error) {
                throw error; // Wyrzucamy błąd prosto do catcha, by go odczytać
            }
            
            alert("Wniosek o dostęp wysłany! Poczekaj, aż Zarząd zaakceptuje Twoje konto.");
            document.getElementById("show-login-btn").click(); // Powrót do logowania
            regForm.reset();
        } catch (err) {
            alert("Odwołany wniosek (Błąd Supabase): \n" + (err.message || "Sprawdź polityki RLS lub upewnij się, że masz takie kolumny w bazie."));
            console.error("Szczegóły błędu rejestracji:", err);
        } finally {
            regBtn.innerText = "Wyślij wniosek do zarządu";
            regBtn.disabled = false;
        }
    });
}

// Zakładki menu
function setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    navButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            navButtons.forEach(b => { b.classList.remove("nav-active"); b.classList.add("nav-inactive"); });
            btn.classList.add("nav-active"); btn.classList.remove("nav-inactive");
            tabContents.forEach(tab => tab.classList.add("hidden"));
            document.getElementById(btn.getAttribute("data-tab")).classList.remove("hidden");
        });
    });
}

// Paragony
function setupReceipts() {
    const form = document.getElementById("receipt-form");
    const btn = document.getElementById("receipt-btn");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        btn.disabled = true;
        btn.innerText = "Zapisywanie...";

        const clientDiscord = document.getElementById("receipt-discord").value;
        const products = document.getElementById("receipt-products").value; // Zbieranie kupionych produktów z HTML
        const amount = parseInt(document.getElementById("receipt-amount").value, 10); // Przymusowy konwert na liczbę (int4)

        try {
            const { error } = await supabaseClient.from('cartel_paragony').insert([
                { seller_name: CurrentUser.fullname, client_discord: clientDiscord, products: products, amount: amount }
            ]);

            if (error) throw error;
            
            alert("Paragon wystawiony pomyślnie!");
            form.reset();
            fetchReceipts(); // Odśwież listę po dodaniu
        } catch (err) {
            alert("Błąd podczas wystawiania paragonu:\n" + err.message);
            console.error("Błąd zapisu paragonu:", err);
        } finally {
            btn.disabled = false;
            btn.innerText = "Zapisz w księgach";
        }
    });
}

// Odczytywanie i rysowanie Paragonów z Bazy
window.fetchReceipts = async function() {
    const list = document.getElementById("receipts-list");
    list.innerHTML = "<p class='text-sm text-gray-500 text-center p-4'>Pobieranie...</p>";

    const { data, error } = await supabaseClient
        .from('cartel_paragony')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        list.innerHTML = `<p class='text-sm text-red-500 text-center p-2'>Błąd ładowania: ${error.message}</p>`;
        return;
    }

    if (!data || !data.length) {
        list.innerHTML = "<p class='text-sm text-gray-500 text-center p-4'>Brak zapisanych transakcji.</p>";
        return;
    }

    list.innerHTML = "";
    data.forEach(receipt => {
        const div = document.createElement("div");
        div.className = "flex justify-between items-center p-3 border-b border-gray-800 last:border-0";
        div.innerHTML = `
            <div>
                <span class="text-sm font-bold text-gray-200">${receipt.client_discord}</span>
                <span class="text-xs text-amber-500 block">Towar: ${receipt.products || 'Brak danych'}</span>
                <span class="text-xs text-gray-500 block">Sprzedał: ${receipt.seller_name}</span>
            </div>
            <div class="text-amber-500 font-mono font-bold">$${receipt.amount}</div>
        `;
        list.appendChild(div);
    });
}

// Panel Zarządu - Pobieranie i akceptowanie kont
window.fetchPendingUsers = async function() {
    const list = document.getElementById("pending-users-list");
    list.innerHTML = "<p class='text-sm text-gray-500'>Szukam wniosków...</p>";

    const { data, error } = await supabaseClient
        .from('cartel_users')
        .select('*')
        .eq('is_approved', false);

    if (error) {
        list.innerHTML = `<p class='text-sm text-red-500'>Błąd bazy danych: ${error.message}</p>`;
        return;
    }

    if (!data || !data.length) {
        list.innerHTML = "<p class='text-sm text-gray-500'>Brak oczekujących kont do akceptacji.</p>";
        return;
    }

    list.innerHTML = "";
    data.forEach(user => {
        const div = document.createElement("div");
        div.className = "bg-[#161a23] p-4 rounded-lg border border-red-900/30 flex justify-between items-center";
        div.innerHTML = `
            <div>
                <p class="font-bold text-gray-200 text-sm">${user.fullname} <span class="text-gray-500 font-normal">(${user.discord})</span></p>
                <p class="text-xs text-gray-400 mt-1">ID: <span class="text-amber-500 font-mono">${user.badge}</span> | Hasło: <span class="text-red-400 font-mono">${user.password}</span></p>
            </div>
            <div class="flex gap-2">
                <button onclick="approveUser(${user.id})" class="bg-green-600/20 text-green-500 border border-green-600 hover:bg-green-600 hover:text-white px-3 py-1.5 rounded text-xs transition cursor-pointer">Akceptuj</button>
                <button onclick="rejectUser(${user.id})" class="bg-red-600/20 text-red-500 border border-red-600 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded text-xs transition cursor-pointer">Odrzuć</button>
            </div>
        `;
        list.appendChild(div);
    });
}

// Funkcje zarządu: Akceptuj / Odrzuć
window.approveUser = async function(userId) {
    if(!confirm("Na pewno chcesz zaakceptować to konto? Gracz będzie mógł się zalogować.")) return;
    await supabaseClient.from('cartel_users').update({ is_approved: true }).eq('id', userId);
    fetchPendingUsers();
};

window.rejectUser = async function(userId) {
    if(!confirm("Odrzucić konto? Zostanie ono trwale usunięte.")) return;
    await supabaseClient.from('cartel_users').delete().eq('id', userId);
    fetchPendingUsers();
};