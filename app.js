// ==========================================
// 1. KONFIGURACJA SUPABASE
// ==========================================
const SUPABASE_URL = "https://azficflfpvwntuufjfne.supabase.co"; 
const SUPABASE_KEY = "TWÓJ_PUBLICZNY_ANON_KEY_Z_SUPABASE"; // <-- WKLEJ TUTAJ SWÓJ ANON KEY

const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Lokalne zmienne stanu sesji i magazynu
let zalogowanyUzytkownik = null;
let aktualnyMagazyn = {
    "Mięso": 0, "Bułka": 0, "Tortilla": 0, "Pomidor": 0, "Sałata": 0
};

// ==========================================
// 2. RECEPTURY I CONFIG KULINARNY
// ==========================================
const RECEPTURY = {
    burger: {
        id: "burger",
        name: "Burger Klasyczny",
        cost: { "Mięso": 1, "Bułka": 1 },
        sequence: ["Bułka", "Mięso", "Bułka"]
    },
    taco: {
        id: "taco",
        name: "Taco Meksykańskie",
        cost: { "Mięso": 1, "Tortilla": 1, "Pomidor": 1, "Sałata": 1 },
        sequence: ["Tortilla", "Mięso", "Pomidor", "Sałata"]
    },
    salatka: {
        id: "salatka",
        name: "Sałatka Wege",
        cost: { "Sałata": 2, "Pomidor": 1 },
        sequence: ["Sałata", "Sałata", "Pomidor"]
    }
};

let stanGry = {
    aktywneDanie: null,
    aktualnyKrok: 0,
    talerzGracza: []
};

const DECK_SKLADNIKOW = ["Bułka", "Mięso", "Sałata", "Pomidor", "Tortilla"];

// ==========================================
// 3. NAWIGACJA MIĘDZY EKRANAMI / ZAKŁADKAMI
// ==========================================
function showScreen(screenId) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('request-screen').classList.add('hidden');
    document.getElementById('main-dashboard').classList.add('hidden');
    
    document.getElementById(screenId).classList.remove('hidden');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    if(tabId === 'magazyn-kuchnia') {
        pobierzStanMagazynu();
    }
}

// ==========================================
// 4. OBSŁUGA LOGOWANIA I WNIOSKÓW (AUTENTYKACJA)
// ==========================================

// Logowanie użytkownika (Tabela cartel_users)
async function handleLogin() {
    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value.trim();

    if (!usernameInput || !passwordInput) {
        return alert("Wypełnij wszystkie pola logowania!");
    }

    try {
        const { data, error } = await supabase
            .from('cartel_users')
            .select('*')
            .eq('username', usernameInput)
            .eq('password', passwordInput)
            .single();

        if (error || !data) {
            return alert("Nieprawidłowy login lub hasło! Albo Twój wniosek nie został jeszcze zaakceptowany.");
        }

        // Pomyślne zalogowanie
        zalogowanyUzytkownik = data;
        document.getElementById('user-display-name').innerText = data.username;
        
        // Przejdź do głównego panelu
        showScreen('main-dashboard');
        switchTab('magazyn-kuchnia');

    } catch (err) {
        console.error("Błąd autentykacji:", err.message);
        alert("Błąd podczas logowania. Sprawdź polityki RLS w bazie.");
    }
}

// Rejestracja nowego wniosku (Tabela cartel_requests)
async function handleAccessRequest() {
    const fullName = document.getElementById('req-name').value.trim();
    const password = document.getElementById('req-password').value.trim();
    const reason = document.getElementById('req-reason').value.trim();

    if (!fullName || !password || !reason) {
        return alert("Wypełnij wszystkie pola wniosku!");
    }

    try {
        const { error } = await supabase
            .from('cartel_requests')
            .insert([
                { name: fullName, password: password, reason: reason }
            ]);

        if (error) throw error;

        alert("🎉 Wniosek został pomyślnie wysłany do bazy danych! Poczekaj na akceptację przez Zarząd.");
        
        // Czyszczenie i powrót
        document.getElementById('req-name').value = "";
        document.getElementById('req-password').value = "";
        document.getElementById('req-reason').value = "";
        showScreen('login-screen');

    } catch (err) {
        console.error("Błąd zapisu wniosku:", err.message);
        alert("Nie udało się wysłać wniosku: " + err.message);
    }
}

function handleLogout() {
    zalogowanyUzytkownik = null;
    document.getElementById('login-username').value = "";
    document.getElementById('login-password').value = "";
    showScreen('login-screen');
}

// ==========================================
// 5. LOGIKA MAGAZYNU (SUPABASE)
// ==========================================

async function pobierzStanMagazynu() {
    try {
        const { data, error } = await supabase
            .from('cartel_magazyn')
            .select('item_name, quantity');

        if (error) throw error;

        Object.keys(aktualnyMagazyn).forEach(k => aktualnyMagazyn[k] = 0);

        if (data && data.length > 0) {
            data.forEach(row => {
                if (aktualnyMagazyn[row.item_name] !== undefined) {
                    aktualnyMagazyn[row.item_name] = row.quantity;
                }
            });
        }
        
        renderujMagazyn();
        if (!stanGry.aktywneDanie) renderujMenuKuchni();

    } catch (err) {
        console.error("Błąd magazynu:", err.message);
        document.getElementById('magazyn-render-target').innerHTML = 
            `<p style="color:var(--danger)">Błąd połączenia z bazą.</p>`;
    }
}

async function handleManualStockUpdate() {
    const itemName = document.getElementById('ingredient-select').value;
    const inputQty = parseInt(document.getElementById('ingredient-qty').value) || 0;

    const nowaIlosc = (aktualnyMagazyn[itemName] || 0) + inputQty;
    if(nowaIlosc < 0) return alert("Stan nie może spaść poniżej 0!");

    try {
        const { error } = await supabase
            .from('cartel_magazyn')
            .upsert({ item_name: itemName, quantity: nowaIlosc }, { onConflict: 'item_name' });

        if (error) throw error;
        await pobierzStanMagazynu();

    } catch (err) {
        alert("Błąd zapisu zmiany stanu: " + err.message);
    }
}

// ==========================================
// 6. RENDEROWANIE INTERFEJSU
// ==========================================

function renderujMagazyn() {
    const container = document.getElementById('magazyn-render-target');
    container.innerHTML = "";

    Object.entries(aktualnyMagazyn).forEach(([nazwa, ilosc]) => {
        const itemRow = document.createElement('div');
        itemRow.className = "magazyn-item";
        itemRow.innerHTML = `<span>${nazwa}</span><span class="qty-tag">${ilosc} szt.</span>`;
        container.appendChild(itemRow);
    });
}

function renderujMenuKuchni() {
    const panel = document.getElementById('kitchen-panel');
    panel.innerHTML = `<h3><i class="fa-solid fa-utensils"></i> Kuchnia La Mesa - Przygotuj Potrawę</h3>`;
    
    const container = document.createElement('div');
    container.className = "dishes-container";

    Object.values(RECEPTURY).forEach(danie => {
        let listaHTML = "";
        Object.entries(danie.cost).forEach(([skladnik, potrzebno]) => {
            listaHTML += `<li><i class="fa-solid fa-circle-chevron-right"></i> ${potrzebno}x ${skladnik}</li>`;
        });

        const card = document.createElement('div');
        card.className = "dish-card";
        card.innerHTML = `
            <div>
                <h4>${danie.name}</h4>
                <ul class="dish-reqs">${listaHTML}</ul>
            </div>
            <button onclick="uruchomProcesGotowania('${danie.id}')">Rozpocznij</button>
        `;
        container.appendChild(card);
    });
    panel.appendChild(container);
}

// ==========================================
// 7. BEZPIECZNA MINIGRA KULINARNA (BEZ LOCKÓW)
// ==========================================

function uruchomProcesGotowania(danieId) {
    const danie = RECEPTURY[danieId];
    let braki = [];
    
    Object.entries(danie.cost).forEach(([skladnik, wymagane]) => {
        if ((aktualnyMagazyn[skladnik] || 0) < wymagane) {
            braki.push(skladnik);
        }
    });

    if (braki.length > 0) {
        return alert(`Braki w magazynie! Nie masz: ${braki.join(', ')}`);
    }

    stanGry.aktywneDanie = danie;
    stanGry.aktualnyKrok = 0;
    stanGry.talerzGracza = [];

    renderujEkranMinigry();
}

function renderujEkranMinigry() {
    const panel = document.getElementById('kitchen-panel');
    const danie = stanGry.aktywneDanie;

    panel.innerHTML = `<h3><i class="fa-solid fa-fire-burner"></i> STANOWISKO ROBOCZE KUCHNI</h3>`;

    const area = document.createElement('div');
    area.className = "cooking-area";

    let sekwencjaHTML = danie.sequence.map((skladnik, index) => {
        const klasaDone = index < stanGry.aktualnyKrok ? "done" : "";
        return `<div class="seq-item ${klasaDone}">${skladnik}</div>`;
    }).join('');

    let talerzHTML = stanGry.talerzGracza.map(s => `<span class="talerz-item">${s}</span>`).join('');
    if(stanGry.talerzGracza.length === 0) talerzHTML = `<span style="color:var(--text-muted); font-size:0.85rem;">TALERZ JEST PUSTY</span>`;

    let deckPrzyciskowHTML = DECK_SKLADNIKOW.map(skladnik => 
        `<button class="ingredient-btn" onclick="klikniecieSkladnika('${skladnik}')">${skladnik}</button>`
    ).join('');

    area.innerHTML = `
        <h2 style="color:var(--accent-gold); margin-bottom:5px;">${danie.name}</h2>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:20px;">Ułóż odpowiednią sekwencję:</p>
        
        <div class="recipe-sequence">${sekwencjaHTML}</div>
        <div class="talerz-box">${talerzHTML}</div>
        <div class="ingredients-deck">${deckPrzyciskowHTML}</div>

        <button class="cancel-cook" onclick="anulujGotowanie()">Wyczyść i anuluj potrawę</button>
    `;
    panel.appendChild(area);
}

async function klikniecieSkladnika(kliknietySkladnik) {
    if (!stanGry.aktywneDanie) return;

    const oczekiwanySkladnik = stanGry.aktywneDanie.sequence[stanGry.aktualnyKrok];

    // ❌ BŁĄD GRACZA - CAŁKOWITY RESET STANU (Zapobiega zamrożeniom)
    if (kliknietySkladnik !== oczekiwanySkladnik) {
        alert("❌ Zła kolejność składników! Danie zepsute. Blat roboczy zostaje wyczyszczony.");
        
        stanGry.aktywneDanie = null;
        stanGry.aktualnyKrok = 0;
        stanGry.talerzGracza = [];
        
        renderujMenuKuchni();
        return;
    }

    //  PRAWIDŁOWY KLIK
    stanGry.talerzGracza.push(kliknietySkladnik);
    stanGry.aktualnyKrok++;

    // Sprawdzenie, czy koniec dania
    if (stanGry.aktualnyKrok === stanGry.aktywneDanie.sequence.length) {
        const wykonaneDanie = stanGry.aktywneDanie;
        alert(`🎉 Gotowe! Przygotowano pomyślnie ${wykonaneDanie.name}.`);

        // Zdjęcie zasobów z Supabase
        for (const [skladnik, iloscDoOdjecia] of Object.entries(wykonaneDanie.cost)) {
            const staryStan = aktualnyMagazyn[skladnik] || 0;
            const nowyStan = Math.max(0, staryStan - iloscDoOdjecia);
            
            await supabase
                .from('cartel_magazyn')
                .upsert({ item_name: skladnik, quantity: nowyStan }, { onConflict: 'item_name' });
        }

        // Czyszczenie stanu gry po sukcesie i pobranie nowego stanu magazynu
        stanGry.aktywneDanie = null;
        stanGry.aktualnyKrok = 0;
        stanGry.talerzGracza = [];
        
        await pobierzStanMagazynu();
    } else {
        renderujEkranMinigry();
    }
}

function anulujGotowanie() {
    stanGry.aktywneDanie = null;
    stanGry.aktualnyKrok = 0;
    stanGry.talerzGracza = [];
    renderujMenuKuchni();
}