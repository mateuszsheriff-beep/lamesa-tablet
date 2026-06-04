// CONFIG_SUPABASE: Zachowaj swoje poprawne klucze!
const SUPABASE_URL = "https://azficflfpvvntuufjfne.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ZmljZmxmcHZ2bnR1dWZqZm5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzY5ODAsImV4cCI6MjA5NjE1Mjk4MH0.1YFCrNluP7IgnlXy8JUgftBiRS6XqQ8LUZP9u389p-c";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let CurrentUser = null;
let localInventory = {}; // Podgląd magazynu w pamięci podręcznej strony

document.addEventListener("DOMContentLoaded", () => {
    setupAuthUI();
    setupLogin();
    setupRegistration();
    setupNavigation();
    setupReceipts();
    setupWarehouse();
    setupAvatarUpload();
});

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

// Logowanie
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
            if (idInput === "001" && passInput === "zarzad") {
                CurrentUser = { badge: "001", fullname: "Zarząd La Mesa", rank: "El Patron (Szef)", discord: "boss_lamesa", is_admin: true, avatar_url: null };
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

            CurrentUser = { ...data, is_admin: false };
            loginSuccess();

        } catch (error) {
            console.error(error);
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
    
    // Rysowanie danych profilowych
    document.getElementById("side-user-name").innerText = CurrentUser.fullname;
    document.getElementById("side-user-rank").innerText = CurrentUser.rank;
    document.getElementById("user-fullname").innerText = CurrentUser.fullname;
    document.getElementById("user-badge").innerText = CurrentUser.badge;
    document.getElementById("user-discord").innerText = CurrentUser.discord;

    // Przypisanie awataru z bazy (lub domyślny)
    const defaultAvatar = "https://i.pravatar.cc/150?img=11";
    document.getElementById("side-user-avatar").src = CurrentUser.avatar_url || defaultAvatar;
    document.getElementById("main-user-avatar").src = CurrentUser.avatar_url || defaultAvatar;

    if (CurrentUser.is_admin) {
        document.getElementById("nav-admin").classList.remove("hidden");
        document.getElementById("admin-warehouse-panel").classList.remove("hidden");
        fetchPendingUsers();
    } else {
        document.getElementById("nav-admin").classList.add("hidden");
        document.getElementById("admin-warehouse-panel").classList.add("hidden");
    }

    fetchReceipts();
    fetchInventory();
}

// Rejestracja
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
            const { error } = await supabaseClient.from('cartel_users').insert([
                { badge: badge, password: pass, fullname: name, discord: discord, is_approved: false, rank: "Rekrut" }
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
            document.getElementById(btn.getAttribute("data-tab")).classList.remove("hidden");
        });
    });
}

// Funkcja wgrywania własnego zdjęcia profilowego (Konwersja do Base64 i zapis do bazy)
function setupAvatarUpload() {
    const avatarInput = document.getElementById("avatar-input");
    
    avatarInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Blokada rozmiaru pliku powyżej 1.5MB żeby kolumna tekstowa to udźwignęła
        if (file.size > 1500000) {
            alert("Zdjęcie jest za duże! Maksymalny rozmiar to 1.5 MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result;

            if (CurrentUser.badge === "001") {
                // Dla szefa lokalnie, bo konto 001 nie siedzi na stałe w tabeli users jako pojedynczy wiersz
                document.getElementById("side-user-avatar").src = base64String;
                document.getElementById("main-user-avatar").src = base64String;
                alert("Zmieniono tymczasowy awatar Szefa.");
                return;
            }

            // Zapis do tabeli cartel_users
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

// Paragony (Wybór z menu + własna nazwa)
function setupReceipts() {
    const form = document.getElementById("receipt-form");
    const btn = document.getElementById("receipt-btn");
    const dishSelect = document.getElementById("receipt-dish-select");
    const customBlock = document.getElementById("custom-dish-block");

    // Dynamiczne pokazywanie inputu na własną nazwę
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
        btn.disabled = true;
        btn.innerText = "Zapisywanie...";

        const clientDiscord = document.getElementById("receipt-discord").value;
        const amount = parseInt(document.getElementById("receipt-amount").value, 10);
        
        // Określanie nazwy towaru
        let finalProduct = "";
        if (dishSelect.value === "CUSTOM") {
            finalProduct = document.getElementById("receipt-custom-products").value;
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
                { seller_name: CurrentUser.fullname, client_discord: clientDiscord, products: finalProduct, amount: amount }
            ]);

            if (error) throw error;
            
            alert("Paragon wystawiony!");
            form.reset();
            customBlock.classList.add("hidden");
            fetchReceipts();
        } catch (err) {
            alert("Błąd zapisu: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "Zapisz w księgach";
        }
    });
}

window.fetchReceipts = async function() {
    const list = document.getElementById("receipts-list");
    list.innerHTML = "<p class='text-sm text-gray-500 text-center p-4'>Pobieranie...</p>";

    const { data, error } = await supabaseClient
        .from('cartel_paragony')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        list.innerHTML = `<p class='text-sm text-red-500 text-center p-2'>Błąd: ${error.message}</p>`;
        return;
    }

    list.innerHTML = "";
    data.forEach(receipt => {
        const div = document.createElement("div");
        div.className = "flex justify-between items-center p-3 border-b border-gray-800 last:border-0 text-xs sm:text-sm";
        div.innerHTML = `
            <div>
                <span class="font-bold text-gray-200">${receipt.client_discord}</span>
                <span class="text-xs text-amber-500 block">Danie/Towar: ${receipt.products || 'Brak'}</span>
                <span class="text-xs text-gray-500 block">Wystawił: ${receipt.seller_name}</span>
            </div>
            <div class="text-amber-500 font-mono font-bold">$${receipt.amount}</div>
        `;
        list.appendChild(div);
    });
}

// SYSTEM MAGAZYNU I KUCHNI
function setupWarehouse() {
    const addForm = document.getElementById("warehouse-add-form");
    
    // Dodawanie/odejmowanie zasobów przez Zarząd
    addForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const itemName = document.getElementById("inv-item-name").value.trim();
        const qtyChange = parseInt(document.getElementById("inv-item-qty").value, 10);

        // Najpierw sprawdzamy czy składnik istnieje w bazie
        const currentQty = localInventory[itemName] || 0;
        const newQty = Math.max(0, currentQty + qtyChange);

        const { error } = await supabaseClient
            .from('cartel_magazyn')
            .upsert({ item_name: itemName, quantity: newQty }, { onConflict: 'item_name' });

        if (error) {
            alert("Błąd aktualizacji magazynu: " + error.message);
        } else {
            alert(`Zaktualizowano stan składnika: ${itemName} (Obecnie: ${newQty})`);
            addForm.reset();
            fetchInventory();
        }
    });
}

// Pobieranie stanu magazynu dla wszystkich pracowników
window.fetchInventory = async function() {
    const list = document.getElementById("inventory-list");
    list.innerHTML = "<p class='text-xs text-gray-500'>Pobieranie danych...</p>";

    const { data, error } = await supabaseClient.from('cartel_magazyn').select('*').order('item_name', { ascending: true });

    if (error) {
        list.innerHTML = "<p class='text-xs text-red-500'>Błąd pobierania składników.</p>";
        return;
    }

    list.innerHTML = "";
    localInventory = {}; // czyszczenie lokalnego cache

    data.forEach(item => {
        localInventory[item.item_name] = item.quantity;
        
        const div = document.createElement("div");
        div.className = "flex justify-between items-center bg-[#161a23] px-3 py-2 rounded-lg border border-gray-800/80 text-xs";
        
        // Kolorowanie w zależności od braków
        const qtyColor = item.quantity < 10 ? "text-red-500 font-bold" : "text-amber-500";
        const alertLabel = item.quantity < 10 ? " <span class='text-[10px] text-red-400 font-normal'>(Kończy się!)</span>" : "";

        div.innerHTML = `
            <span class="font-medium text-gray-300">📦 ${item.item_name}${alertLabel}</span>
            <span class="font-mono ${qtyColor}">${item.quantity} szt.</span>
        `;
        list.appendChild(div);
    });
};

// KRAFCENIE DAŃ (Używane przez pracowników)
window.craftDish = async function(dishType) {
    let requirements = {};
    let dishName = "";

    // Definiowanie receptur kulinarnych kartelu
    if (dishType === 'Burger') {
        requirements = { "Mięso": 1, "Bułka": 1 };
        dishName = "Burger Klasyczny";
    } else if (dishType === 'Taco') {
        requirements = { "Mięso": 1, "Tortilla": 1, "Pomidor": 1 };
        dishName = "Taco Meksykańskie";
    } else if (dishType === 'Salatka') {
        requirements = { "Sałata": 2, "Pomidor": 1 };
        dishName = "Sałatka Wege";
    }

    // Sprawdzenie czy w magazynie jest wystarczająco zasobów
    for (const [ingredient, neededQty] of Object.entries(requirements)) {
        const available = localInventory[ingredient] || 0;
        if (available < neededQty) {
            alert(`Błąd: W magazynie brakuje składnika: "${ingredient}". Potrzebujesz ${neededQty}, a jest tylko ${available}!`);
            return;
        }
    }

    // Odejmowanie składników w bazie danych
    try {
        for (const [ingredient, neededQty] of Object.entries(requirements)) {
            const currentQty = localInventory[ingredient];
            const updatedQty = currentQty - neededQty;

            const { error } = await supabaseClient
                .from('cartel_magazyn')
                .update({ quantity: updatedQty })
                .eq('item_name', ingredient);

            if (error) throw error;
        }

        alert(`Sukces! Przygotowano pomyślnie potrawę: ${dishName}. Składniki zostały pobrane z magazynu.`);
        fetchInventory(); // Odśwież stan magazynu na ekranie
    } catch (err) {
        alert("Wystąpił problem przy krafceniu potrawy: " + err.message);
    }
};

// Panel Zarządu - Wnioski
window.fetchPendingUsers = async function() {
    const list = document.getElementById("pending-users-list");
    list.innerHTML = "<p class='text-sm text-gray-500'>Szukam wniosków...</p>";

    const { data, error } = await supabaseClient.from('cartel_users').select('*').eq('is_approved', false);

    if (error) {
        list.innerHTML = `<p class='text-sm text-red-500'>Błąd bazy: ${error.message}</p>`;
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
                <p class="text-xs text-gray-400 mt-1">ID: <span class="text-amber-500 font-mono">${user.badge}</span></p>
            </div>
            <div class="flex gap-2">
                <button onclick="approveUser(${user.id})" class="bg-green-600/20 text-green-500 border border-green-600 hover:bg-green-600 hover:text-white px-3 py-1.5 rounded text-xs transition cursor-pointer">Akceptuj</button>
                <button onclick="rejectUser(${user.id})" class="bg-red-600/20 text-red-500 border border-red-600 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded text-xs transition cursor-pointer">Odrzuć</button>
            </div>
        `;
        list.appendChild(div);
    });
}

window.approveUser = async function(userId) {
    if(!confirm("Zaakceptować to konto?")) return;
    await supabaseClient.from('cartel_users').update({ is_approved: true }).eq('id', userId);
    fetchPendingUsers();
};

window.rejectUser = async function(userId) {
    if(!confirm("Usunąć ten wniosek?")) return;
    await supabaseClient.from('cartel_users').delete().eq('id', userId);
    fetchPendingUsers();
};