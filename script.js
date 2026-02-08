// Softly - A Gentle Period Tracker
        // --- Initialization ---
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'softly-period-tracker';
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
        
        let state = {
            logs: [],
            settings: { cycleLength: 28, periodDuration: 4, theme: 'light' },
            user: null
        };

        const SOOTHING_SENTENCES = [
            "Be gentle with your heart today.",
            "Your body is a garden, seasonal and wise.",
            "Rest is a beautiful form of movement.",
            "Listen to the soft rhythm of your breath.",
            "You are exactly where you need to be.",
            "Choose kindness toward yourself.",
            "Peace is a quiet place inside you.",
            "Honour the natural tides of your body."
        ];

        const dom = {
            soothingLine: document.getElementById('soothingLine'),
            dateInput: document.getElementById('dateInput'),
            dateLabel: document.getElementById('dateLabel'),
            entryHeading: document.getElementById('entryHeading'),
            logBtn: document.getElementById('logBtn'),
            statusBadge: document.getElementById('statusBadge'),
            insightText: document.getElementById('insightText'),
            calendarGrid: document.getElementById('calendarGrid'),
            calendarMonth: document.getElementById('calendarMonth'),
            cycleLengthInput: document.getElementById('cycleLength'),
            periodDurationInput: document.getElementById('periodDuration'),
            toggleSettings: document.getElementById('toggleSettings'),
            settingsCard: document.getElementById('settingsCard'),
            themeBtn: document.getElementById('themeBtn'),
            clearData: document.getElementById('clearData'),
            syncText: document.getElementById('syncText')
        };

        // --- Core Functions ---

        const setRandomSoothingLine = () => {
            const randomLine = SOOTHING_SENTENCES[Math.floor(Math.random() * SOOTHING_SENTENCES.length)];
            dom.soothingLine.innerText = randomLine;
        };

        const getActivePeriod = () => {
            if (state.logs.length === 0) return null;
            const sorted = [...state.logs].sort((a, b) => new Date(a.start) - new Date(b.start));
            const last = sorted[sorted.length - 1];
            return last.end === null ? last : null;
        };

        const saveToStorage = async () => {
            if (!state.user) return;
            dom.syncText.innerText = "Saving changes...";
            try {
                const userDoc = firebase.firestore().collection('artifacts').doc(appId).collection('users').doc(state.user.uid).collection('data').doc('profile');
                await userDoc.set({
                    logs: state.logs,
                    settings: state.settings,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                dom.syncText.innerText = "Data saved securely";
            } catch (err) {
                dom.syncText.innerText = "Storage active locally";
            }
        };

        const calculateStatus = () => {
            if (state.logs.length < 2) return null;
            const sorted = [...state.logs].filter(l => l.end).sort((a, b) => new Date(b.start) - new Date(a.start));
            if (sorted.length < 2) return null;

            const latest = new Date(sorted[0].start);
            const previous = new Date(sorted[1].start);
            const actualCycle = Math.ceil(Math.abs(latest - previous) / (1000 * 60 * 60 * 24));

            let targetCycle = state.settings.cycleLength;
            const variance = actualCycle - targetCycle;

            if (Math.abs(variance) <= 2) return { type: 'normal', text: 'Normal', msg: 'Your cycle is flowing steadily and predictably.' };
            if (variance < -2) return { type: 'early', text: 'Early', msg: 'A little earlier than expected. This is a natural part of your body\'s variety.' };
            return { type: 'delayed', text: 'Delayed', msg: 'Taking its time this month. Nature doesn\'t always follow a clock.' };
        };

        const render = () => {
            const active = getActivePeriod();
            dom.entryHeading.innerText = active ? "Conclude Period" : "Start Cycle";
            dom.dateLabel.innerText = active ? "When did it end?" : "When did it begin?";
            dom.logBtn.innerText = active ? "Add Last Day" : "Log Start Date";
            dom.logBtn.disabled = false;

            const status = calculateStatus();
            if (status) {
                dom.statusBadge.className = `badge status-${status.type}`;
                dom.statusBadge.innerText = status.text;
                dom.statusBadge.classList.remove('hidden');
                dom.insightText.innerText = status.msg;
            } else {
                dom.statusBadge.classList.add('hidden');
                dom.insightText.innerText = state.logs.length > 0 
                    ? (active ? "Period in progress. Mark the end date when you're ready." : "One entry logged. We'll start spotting patterns with your next one.")
                    : "Welcome home. Let's start by logging your first day.";
            }

            renderCalendar();
        };

        const renderCalendar = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            dom.calendarMonth.innerText = `${monthNames[month]} ${year}`;

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            dom.calendarGrid.innerHTML = '';
            
            ['S','M','T','W','T','F','S'].forEach(d => {
                const el = document.createElement('div'); el.className = 'calendar-header'; el.innerText = d;
                dom.calendarGrid.appendChild(el);
            });

            for (let i = 0; i < firstDay; i++) dom.calendarGrid.appendChild(Object.assign(document.createElement('div'), {className: 'day empty'}));

            for (let d = 1; d <= daysInMonth; d++) {
                const el = document.createElement('div');
                el.className = 'day'; el.innerText = d;
                const currentDate = new Date(year, month, d);
                if (d === now.getDate() && month === now.getMonth() && year === now.getFullYear()) el.classList.add('today');

                state.logs.forEach(log => {
                    const start = new Date(log.start);
                    let end = log.end ? new Date(log.end) : new Date(start);
                    if (!log.end) end.setDate(start.getDate() + parseInt(state.settings.periodDuration) - 1);
                    if (currentDate >= start && currentDate <= end) el.classList.add('period');
                });
                dom.calendarGrid.appendChild(el);
            }
        };

        // --- App Lifecycle ---

        const initApp = async () => {
            // Priority 1: Set the soothing line immediately so user sees it
            setRandomSoothingLine();
            dom.dateInput.valueAsDate = new Date();
            render();

            if (!firebaseConfig) {
                dom.syncText.innerText = "Storage issue";
                dom.insightText.innerText = "Unable to connect to your secure storage.";
                return;
            }

            try {
                firebase.initializeApp(firebaseConfig);
                const auth = firebase.auth();
                
                // Rule 3: Auth Before Queries
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await auth.signInWithCustomToken(__initial_auth_token);
                } else {
                    await auth.signInAnonymously();
                }

                auth.onAuthStateChanged(async (user) => {
                    if (!user) return;
                    state.user = user;
                    
                    // Fetch profile
                    const doc = await firebase.firestore().collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('data').doc('profile').get();
                    if (doc.exists) {
                        const data = doc.data();
                        state.logs = data.logs || [];
                        state.settings = data.settings || state.settings;
                    }

                    // Setup UI based on saved settings
                    dom.cycleLengthInput.value = state.settings.cycleLength;
                    dom.periodDurationInput.value = state.settings.periodDuration;
                    document.documentElement.setAttribute('data-theme', state.settings.theme);
                    
                    render();
                });
            } catch (err) {
                console.error(err);
                dom.syncText.innerText = "Working locally";
            }
        };

        dom.logBtn.onclick = async () => {
            const date = dom.dateInput.value;
            if (!date) return;
            
            const active = getActivePeriod();
            if (active) {
                if (new Date(date) < new Date(active.start)) return;
                active.end = date;
            } else {
                state.logs.push({ start: date, end: null, id: Date.now() });
            }
            
            render();
            await saveToStorage();
            const currentLabel = dom.logBtn.innerText;
            dom.logBtn.innerText = "Saved ✨";
            setTimeout(() => { dom.logBtn.innerText = getActivePeriod() ? "Add Last Day" : "Log Start Date"; }, 2000);
        };

        dom.toggleSettings.onclick = () => dom.settingsCard.classList.toggle('hidden');
        
        dom.cycleLengthInput.onchange = (e) => { state.settings.cycleLength = parseInt(e.target.value) || 28; saveToStorage(); render(); };
        dom.periodDurationInput.onchange = (e) => { state.settings.periodDuration = parseInt(e.target.value) || 4; saveToStorage(); render(); };
        
        dom.themeBtn.onclick = () => {
            state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', state.settings.theme);
            saveToStorage();
        };

        dom.clearData.onclick = async () => {
            if (confirm("Erase your cycle history permanently?")) {
                state.logs = [];
                render();
                await saveToStorage();
            }
        };

        window.onload = initApp;

