// CONFIG_SUPABASE: Podmień poniższe dane na swoje dane z panelu Supabase (Project Settings -> API)
const SUPABASE_URL = "https://TWÓJ_PROJEKT.supabase.co";
const SUPABASE_ANON_KEY = "TWÓJ_ANON_KEY_Z_SUPABASE";

// Inicjalizacja klienta Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Przykładowe dane zalogowanego członka kartelu (możesz potem zastąpić to pobieraniem z bazy)
const CurrentUser = {
    fullname: "Jan Bukowski",
    badge: "353133",
    rank: "Sicario (Starszy żołnierz)",
    discord: "sheriff13_"
};

// Funkcja wykonująca się po załadowaniu strony
document.addEventListener("DOMContentLoaded", () => {
    loadUserProfile();
    setupFormListener();
});

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
            /* Wymagana tabela w Supabase o nazwie: 'cartel_requests'
               Kolumny w bazie do stworzenia:
               - id (int8 / uuid, auto-increment)
               - created_at (timestamp)
               - user_name (text)
               - user_badge (text)
               - request_type (text)
               - reason (text)
               - status (text, default: 'Oczekuje')
            */
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