// ==========================================
// 1. KONFIGURACJA SUPABASE
// ==========================================
const SUPABASE_URL = "https://azficflfpvwntuufjfne.supabase.co"; 
const SUPABASE_KEY = "TWÓJ_PUBLICZNY_ANON_KEY_Z_SUPABASE"; // <-- WKLEJ TUTAJ SWÓJ ANON KEY

const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Globalny słownik przechowujący aktualne stany z bazy danych
let aktualnyMagazyn = {
    "Mięso": 0,
    "Bułka": 0,
    "Tortilla": 0,
    "Pomidor": 0,
    "Sałata": 0
};

// ==========================================
// 2. RECEPTURY I CONFIG MINIGRY KULINARNEJ
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
        sequence: ["Tortilla", "Mięso", "Pomidor", "Sałata"] // Kolejność sprawdzana w grze
    },
    salatka: {
        id: "salatka",
        name: "Sałatka Wege",
        cost: { "Sałata": 2, "Pomidor": 1 },
        sequence: ["Sałata", "Sałata", "Pomidor"]
    }
};

// Struktura stanu aktywnego gotowania
let stanGry = {
    aktywneDanie: null,      // Obiekt wybranej potrawy z RECEPTURY
    aktualnyKrok: 0,         // Indeks składnika, który gracz MUSI teraz kliknąć
    talerzGracza: []         // Składniki pomyślnie ułożone przez gracza
};

// Listy wymieszanych przycisków na blacie roboczym
const DECK_SKLADNIKOW = ["Bułka", "Mięso", "Sałata", "Pomidor", "Tortilla"];

// ==========================================
// 3. OBSŁUGA ZAKŁADEK (ROUTER)
// ==========================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    
    // Podświetlenie odpowiedniego elementu w menu bocznym
    const eventSource = event?.currentTarget;
    if(eventSource) eventSource.classList.add('active');

    if(tabId === 'magazyn-kuchnia') {
        pobierzStanMagazynu();
    }
}

// ==========================================
// 4. LOGIKA BAZY DANYCH (SUPABASE)
// ==========================================

// Pobieranie aktualnych ilości z tabeli cartel_magazyn
async function pobierzStanMagazynu() {
    try {
        const { data, error } = await supabase
            .from('cartel_magazyn')
            .select('item_name, quantity');

        if (error) throw error;

        // Reset lokalnego stanu
        Object.keys(aktualnyMagazyn).forEach(k => aktualnyMagazyn[k] = 0);

        // Mapowanie pobranych danych do słownika
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
        console.error("Błąd pobierania magazynu:", err.message);
        document.getElementById('magazyn-render-target').innerHTML = 
            `<p style="color:var(--danger)">Błąd połączenia z bazą danych.</p>`;
    }
}

// Ręczna modyfikacja przez Panel Zarządu
async function handleManualStockUpdate() {
    const itemName = document.getElementById('ingredient-select').value;
    const inputQty = parseInt(document.getElementById('ingredient-qty').value) || 0;

    const nowaIlosc = (aktualnyMagazyn[itemName] || 0) + inputQty;
    if(nowaIlosc < 0) return alert("Stan magazynu nie może spaść poniżej 0 sztuk!");

    await zapiszSkladnikWBazie(itemName, nowaIlosc);
}

// Pomocnicza funkcja wykonująca UPSERT w tabeli cartel_magazyn
async function zapiszSkladnikWBazie(name, value) {
    try {
        const { error } = await supabase
            .from('cartel_magazyn')
            .upsert({ item_name: name, quantity: value }, { onConflict: 'item_name' });

        if (error) throw error;
        await pobierzStanMagazynu(); // Odśwież widok

    } catch (err) {
        alert("Błąd zapisu w bazie Supabase: " + err.message);
    }
}

// ==========================================
// 5. WIZUALIZACJA INTERFEJSU (RENDERERY)
// ==========================================

function renderujMagazyn() {
    const container = document.getElementById('magazyn-render-target');
    container.innerHTML = "";

    Object.entries(aktualnyMagazyn).forEach(([nazwa, ilosc]) => {
        const itemRow = document.createElement('div');
        itemRow.className = "magazyn-item";
        itemRow.innerHTML = `
            <span>${nazwa}</span>
            <span class="qty-tag">${ilosc} szt.</span>
        `;
        container.appendChild(itemRow);
    });
}

function renderujMenuKuchni() {
    const panel = document.getElementById('kitchen-panel');
    panel.innerHTML = `<h3><i class="fa-solid fa-utensils"></i> Kuchnia U BCSO - Przygotuj Danie</h3>`;
    
    const container = document.createElement('div');
    container.className = "dishes-container";

    Object.values(RECEPTURY).forEach(danie => {
        // Generowanie listy wymaganych składników
        let listaSkladnikowHTML = "";
        Object.entries(danie.cost).forEach(([skladnik, potrzebno]) => {
            listaSkladnikowHTML += `<li><i class="fa-solid fa-circle-chevron-right"></i> ${potrzebno}x ${skladnik}</li>`;
        });

        const card = document.createElement('div');
        card.className = "dish-card";
        card.innerHTML = `
            <div>
                <h4>${danie.name}</h4>
                <ul class="dish-reqs">${listaSkladnikowHTML}</ul>
            </div>
            <button onclick="uruchomProcesGotowania('${danie.id}')">Rozpocznij przygotowanie</button>
        `;
        container.appendChild(card);
    });

    panel.appendChild(container);
}

// ==========================================
// 6. ROZBUDOWANA I BEZPIECZNA MINIGRA KULINARNA
// ==========================================

function uruchomProcesGotowania(danieId) {
    const danie = RECEPTURY[danieId];
    
    // Sprawdzenie, czy w magazynie jest wystarczająco dużo półproduktów
    let braki = [];
    Object.entries(danie.cost).forEach(([skladnik, wymagane]) => {
        if ((aktualnyMagazyn[skladnik] || 0) < wymagane) {
            braki.push(skladnik);
        }
    });

    if (braki.length > 0) {
        return alert(`Braki w magazynie! Nie masz wystarczającej ilości: ${braki.join(', ')}`);
    }

    // Inicjalizacja stanu rozgrywki
    stanGry.aktywneDanie = danie;
    stanGry.aktualnyKrok = 0;
    stanGry.talerzGracza = [];

    renderujEkranMinigry();
}

function renderujEkranMinigry() {
    const panel = document.getElementById('kitchen-panel');
    const danie = stanGry.aktywneDanie;

    panel.innerHTML = `<h3><i class="fa-solid fa-fire-burner"></i> TRYB PRZYGOTOWYWANIA POTRAWY</h3>`;

    const area = document.createElement('div');
    area.className = "cooking-area";

    // Budowanie sekwencji ściągi przepisu
    let sekwencjaHTML = "";
    danie.sequence.forEach((skladnik, index) => {
        const klasaDone = index < stanGry.aktualnyKrok ? "done" : "";
        sekwencjaHTML += `<div class="seq-item ${klasaDone}">${skladnik}</div>`;
    });

    // Budowanie elementów znajdujących się na talerzu
    let talerzHTML = stanGry.talerzGracza.map(s => `<span class="talerz-item">${s}</span>`).join('');
    if(stanGry.talerzGracza.length === 0) talerzHTML = `<span style="color:var(--text-muted); font-size:0.85rem;">TWÓJ TALERZ JEST PUSTY</span>`;

    // Przekazywanie HTML z wymieszanym blatem roboczym
    let deckPrzyciskowHTML = DECK_SKLADNIKOW.map(skladnik => 
        `<button class="ingredient-btn" onclick="klikniecieSkladnika('${skladnik}')">${skladnik}</button>`
    ).join('');

    area.innerHTML = `
        <h2 style="color:var(--accent-gold); margin-bottom:5px;">${danie.name}</h2>
        <p style="font-size:0.85rem; color:var(--text-muted);">Ułóż składniki w podanej kolejności:</p>
        
        <div class="recipe-sequence">${sekwencjaHTML}</div>
        
        <p style="font-size:0.8rem; text-align:left; color:var(--text-muted); margin-bottom:5px;">TWÓJ TALERZ:</p>
        <div class="talerz-box">${talerzHTML}</div>

        <p style="font-size:0.8rem; text-align:left; color:var(--text-muted); margin-bottom:5px;">BLAT ROBOCZY (KLIKAJ KOLEJNO):</p>
        <div class="ingredients-deck">${deckPrzyciskowHTML}</div>

        <button class="cancel-cook" onclick="anulujGotowanie()">Anuluj i wyczyść blat</button>
    `;

    panel.appendChild(area);
}

// KLUCZOWA POPRAWKA: Obsługa kliknięć z pełnym, automatycznym czyszczeniem zamrożeń
async function klikniecieSkladnika(kliknietySkladnik) {
    if (!stanGry.aktywneDanie) return;

    const oczekiwanySkladnik = stanGry.aktywneDanie.sequence[stanGry.aktualnyKrok];

    // ❌ BŁĄD GRACZA - ZŁA KOLEJNOŚĆ
    if (kliknietySkladnik !== oczekiwanySkladnik) {
        alert("❌ Zła kolejność! Przepis zepsuty, twój blat roboczy ląduje w koszu. Zaczynasz od nowa!");
        
        // WYCZYŚĆ STAN NATYCHMIAST - zapobiega permanentnemu zamrożeniu ekranu
        stanGry.aktywneDanie = null;
        stanGry.aktualnyKrok = 0;
        stanGry.talerzGracza = [];
        
        renderujMenuKuchni(); // Cofnij gracza do menu wyboru dań
        return;
    }

    //  POPRAWNY SKŁADNIK
    stanGry.talerzGracza.push(kliknietySkladnik);
    stanGry.aktualnyKrok++;

    // Sprawdzenie czy potrawa jest w pełni skończona
    if (stanGry.aktualnyKrok === stanGry.aktywneDanie.sequence.length) {
        const wykonaneDanie = stanGry.aktywneDanie;
        
        alert(`🎉 Sukces! Pomyślnie przygotowano ${wykonaneDanie.name}! Zdejmuję składniki z magazynu.`);
        
        // Zapisz zmiany w Supabase (odejmij zużyte zasoby)
        for (const [skladnik, iloscDoOdjecia] of Object.entries(wykonaneDanie.cost)) {
            const staryStan = aktualnyMagazyn[skladnik] || 0;
            const nowyStan = Math.max(0, staryStan - iloscDoOdjecia);
            
            // Wysyłanie zmian asynchronicznie do bazy danych
            await supabase
                .from('cartel_magazyn')
                .upsert({ item_name: skladnik, quantity: nowyStan }, { onConflict: 'item_name' });
        }

        // Całkowity reset i odświeżenie danych po sukcesie
        stanGry.aktywneDanie = null;
        stanGry.aktualnyKrok = 0;
        stanGry.talerzGracza = [];
        
        await pobierzStanMagazynu();
    } else {
        // Kontynuuj grę - zaktualizuj interfejs o nowy krok
        renderujEkranMinigry();
    }
}

function anulujGotowanie() {
    stanGry.aktywneDanie = null;
    stanGry.aktualnyKrok = 0;
    stanGry.talerzGracza = [];
    renderujMenuKuchni();
}

// Inicjalizacja przy starcie strony
window.addEventListener('DOMContentLoaded', () => {
    pobierzStanMagazynu();
});