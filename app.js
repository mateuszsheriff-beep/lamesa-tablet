// CONFIG_SUPABASE: Podmień poniższe dane na swoje dane z panelu Supabase (Project Settings -> API)
const SUPABASE_URL = "https://TWÓJ_PROJEKT.supabase.co";
const SUPABASE_ANON_KEY = "TWÓJ_ANON_KEY_Z_SUPABASE";

// Inicjalizacja klienta Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Dane zalogowanego członka zarządu (Zostaną wczytane po pomyślnym zalogowaniu)
let CurrentUser = {
    fullname: "Zarząd La Mesa",
    badge: "001",
    rank: "El Patron (Szef)",
    discord: "boss_lamesa"
};

// Funkcja wykonująca się po załadowaniu strony
document.addEventListener("DOMContentLoaded", () => {
    setupLoginSystem();
    setupNavigation();
    setupFormListener();
});

// Obsługa systemu logowania
function setupLoginSystem() {
    const loginForm = document.getElementById("login-form");
    const loginScreen = document.getElementById("login-screen");
    const mainApp = document.getElementById("main-app");
    const logoutBtn = document.getElementById("logout-btn");

    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const idInput = document.getElementById("login-id").value;
        const passInput = document.getElementById("login-pass").value;

        // Sprawdzanie danych logowania podanych przez Ciebie
        if (idInput === "001" && passInput === "zarzad") {
            // Sukces - schowaj logowanie, pokaż aplikację
            loginScreen.classList.add("hidden");
            mainApp.classList.remove("hidden");
            
            // Załaduj dane do HTML
            loadUserProfile();
        } else {
            alert("Odmowa dostępu! Błędny numer pracownika lub hasło.");
        }
    });

    // Przycisk wylogowania w lewym dolnym rogu
    logoutBtn.addEventListener("click", () => {
        mainApp.classList.add("hidden");
        loginScreen.classList.remove("hidden");
        document.getElementById("login-pass").value = ""; // Czyści hasło po wylogowaniu
    });
}

// Obsługa zakładek (Przełączanie przycisków w menu bocznym)
function setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");

    navButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();

            // 1. Zresetuj wygląd wszystkich przycisków menu
            navButtons.forEach(b => {
                b.classList.remove("nav-active");
                b.classList.add("nav-inactive");
            });

            // 2. Nadaj aktywny wygląd klikniętemu przyciskowi
            btn.classList.add("nav-active");
            btn.classList.remove("nav-inactive");

            // 3. Ukryj wszystkie sekcje z zawartością
            tabContents.forEach(tab => tab.classList.add("hidden"));

            // 4. Pokaż wybraną sekcję
            const targetTabId = btn.getAttribute("data-tab");
            document.getElementById(targetTabId).classList.remove("hidden");

            // 5. Zmiana tytułów na górze w zależności od wybranej zakładki
            if(targetTabId === "tab-panel") {
                pageTitle.innerText = "Panel Funkcjonariusza Kartelu";
                pageSubtitle.innerText = "Twój profil, aktywne urlopy oraz składanie wniosków wewnętrznych.";
            } else if(targetTabId === "tab-magazyn") {
                pageTitle.innerText = "Magazyn & Zaopatrzenie";
                pageSubtitle.innerText = "Przeglądaj stan inwentarza i zlecaj dostawy z czarnego rynku.";
            } else if(targetTabId === "tab-dokumenty") {
                pageTitle.innerText = "Dokumentacja i Umowy";
                pageSubtitle.innerText = "Rejestr legalnych biznesów i pralni brudnych pieniędzy.";
            } else if(targetTabId === "tab-kasa") {
                pageTitle.innerText = "Rozliczenia & Kasa";
                pageSubtitle.innerText = "Finansowe zestawienie działań organizacji.";
            } else if(targetTabId === "tab-kodeks") {
                pageTitle.innerText = "Kodeks & Cennik";
                pageSubtitle.innerText = "Zasady obowiązujące na terytorium La Mesa.";
            }
        });
    });
}

// Wstrzykiwanie danych użytkownika do HTML (Profil Kartelu)
function loadUserProfile() {
    document.getElementById("side-user-name").innerText = CurrentUser.fullname;
    document.getElementById("side-user-rank").innerText = CurrentUser.rank;
    
    document.getElementById("user-fullname").innerText = CurrentUser.fullname;
    document.getElementById("user-badge").innerText = CurrentUser.badge;
    document.getElementById("user-rank").innerText = CurrentUser.rank;
    document.getElementById("user-discord").innerText = CurrentUser.discord;
}

// Obsługa wysyłania formularza wniosków do Supabase
function setupFormListener() {
    const form = document.getElementById("request-form");
    const submitBtn = document.getElementById("submit-btn");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Pobranie danych z formularza
        const requestType = document.getElementById("request-type").value;
        const requestReason = document.getElementById("request-reason").value;

        // Zmiana stanu przycisku na ładowanie
        submitBtn.innerText = "Wysyłanie...";
        submitBtn.disabled = true;

        try {
            const { data, error } = await supabase
                .from('cartel_requests')
                .insert([
                    { 
                        user_name: CurrentUser.fullname, 
                        user_badge: CurrentUser.badge, 
                        request_type: requestType, 
                        reason: requestReason,
                        status: 'Oczekuje'
                    }
                ]);

            if (error) throw error;

            // Sukces
            alert("Wniosek pomyślnie zapisany w bazie danych La Mesa Cartel!");
            form.reset();

        } catch (error) {
            console.error("Błąd podczas wysyłania do Supabase:", error.message);
            alert("Wystąpił błąd systemu podczas wysyłania. Sprawdź konsolę (F12) lub połączenie Supabase.");
        } finally {
            // Przywrócenie przycisku
            submitBtn.innerText = "Wyślij wniosek do zarządu";
            submitBtn.disabled = false;
        }
    });
}