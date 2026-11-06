import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Utensils, ChartNoAxesCombined, Dumbbell, TrendingUp,
  Settings, Menu, Bell, Leaf, Plus, Flame, Droplets, Beef, Wheat, Apple,
  Trash2, Download, Upload, Moon, Sun, Scale, CalendarDays,
  Activity, Save
} from "lucide-react";
import FoodDiary from "./FoodDiary";
import './App.css';
const KEYS = {
  food: "fitfuel-food-diary",
  water: "fitfuel-water-tracker",
  goals: "fitfuel-goals",
  weight: "fitfuel-weight-log",
  workouts: "fitfuel-workouts",
  theme: "fitfuel-theme"
};

const DEFAULT_GOALS = {
  calories: 2500,
  protein: 140,
  carbs: 300,
  fat: 80,
  water: 8
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const read = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) =>
  localStorage.setItem(key, JSON.stringify(value));

const dateLabel = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short"
  });

const num = (v) => Number(v) || 0;

function App() {
  const [page, setPage] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const [goals, setGoals] = useState(() => ({
    ...DEFAULT_GOALS,
    ...read(KEYS.goals, {})
  }));

  const [waterLog, setWaterLog] = useState(() => {
    const saved = read(KEYS.water, {});

    // Migrate the older single-day water format.
    if (saved && saved.date && saved.count !== undefined) {
      return { [saved.date]: num(saved.count) };
    }

    return saved;
  });

  const [foods, setFoods] = useState(() => read(KEYS.food, []));
  const [weights, setWeights] = useState(() => read(KEYS.weight, []));
  const [workouts, setWorkouts] = useState(() => read(KEYS.workouts, []));
  const [dark, setDark] = useState(() => read(KEYS.theme, false));

  const [weightInput, setWeightInput] = useState("");
  const [weightDate, setWeightDate] = useState(today());

  const [workout, setWorkout] = useState({
    name: "",
    type: "Strength",
    minutes: "",
    notes: ""
  });

  const [goalDraft, setGoalDraft] = useState(goals);
  const [backupMessage, setBackupMessage] = useState("");

  useEffect(() => write(KEYS.goals, goals), [goals]);
  useEffect(() => write(KEYS.water, waterLog), [waterLog]);
  useEffect(() => write(KEYS.weight, weights), [weights]);
  useEffect(() => write(KEYS.workouts, workouts), [workouts]);
  useEffect(() => write(KEYS.theme, dark), [dark]);

  useEffect(() => {
    const refresh = () => setFoods(read(KEYS.food, []));

    window.addEventListener("fitfuel-food-updated", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("fitfuel-food-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const todayFoods = foods.filter(
    (f) => (f.date || today()) === today()
  );

  const totals = todayFoods.reduce(
    (a, f) => ({
      calories: a.calories + num(f.calories),
      protein: a.protein + num(f.protein),
      carbs: a.carbs + num(f.carbs),
      fat: a.fat + num(f.fat)
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    }
  );

  const todayWater = num(waterLog[today()]);

  const nav = [
    ["Dashboard", LayoutDashboard],
    ["Food Diary", Utensils],
    ["Nutrition", ChartNoAxesCombined],
    ["Workouts", Dumbbell],
    ["Progress", TrendingUp],
    ["Settings", Settings]
  ];

  function changeWater(amount) {
    setWaterLog((old) => ({
      ...old,
      [today()]: Math.max(
        0,
        Math.min(
          goals.water,
          num(old[today()]) + amount
        )
      )
    }));
  }

  function addWeight(e) {
    e.preventDefault();

    if (!weightInput || num(weightInput) <= 0) return;

    setWeights((old) => [
      ...old.filter((x) => x.date !== weightDate),
      {
        id: Date.now(),
        date: weightDate,
        weight: num(weightInput)
      }
    ].sort((a, b) => a.date.localeCompare(b.date)));

    setWeightInput("");
  }

  function addWorkout(e) {
    e.preventDefault();

    if (!workout.name.trim()) return;

    setWorkouts((old) => [
      {
        ...workout,
        id: Date.now(),
        date: today(),
        minutes: num(workout.minutes)
      },
      ...old
    ]);

    setWorkout({
      name: "",
      type: "Strength",
      minutes: "",
      notes: ""
    });
  }

  function exportData() {
    const data = {};

    Object.entries(KEYS).forEach(([name, key]) => {
      data[name] = read(
        key,
        name === "theme" ? false : []
      );
    });

    data.goals = goals;
    data.water = waterLog;
    data.food = foods;
    data.weight = weights;
    data.workouts = workouts;
    data.theme = dark;

    const blob = new Blob(
      [
        JSON.stringify(
          {
            app: "FitFuel",
            version: 2,
            exportedAt: new Date().toISOString(),
            data
          },
          null,
          2
        )
      ],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `fitfuel-backup-${today()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    setBackupMessage("Backup downloaded.");
  }

  function importData(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const d = parsed.data || parsed;

        if (Array.isArray(d.food)) {
          write(KEYS.food, d.food);
          setFoods(d.food);
        }

        if (d.goals && typeof d.goals === "object") {
          setGoals({
            ...DEFAULT_GOALS,
            ...d.goals
          });
        }

        if (d.water && typeof d.water === "object") {
          setWaterLog(d.water);
        }

        if (Array.isArray(d.weight)) {
          setWeights(d.weight);
        }

        if (Array.isArray(d.workouts)) {
          setWorkouts(d.workouts);
        }

        if (typeof d.theme === "boolean") {
          setDark(d.theme);
        }

        setBackupMessage("Backup restored successfully.");

        window.dispatchEvent(
          new Event("fitfuel-food-updated")
        );
      } catch {
        setBackupMessage(
          "That file is not a valid FitFuel backup."
        );
      }
    };

    reader.readAsText(file);
    e.target.value = "";
  }

  function saveGoals(e) {
    e.preventDefault();

    setGoals(
      Object.fromEntries(
        Object.entries(goalDraft).map(([k, v]) => [
          k,
          Math.max(1, num(v))
        ])
      )
    );

    setBackupMessage("Your goals have been saved.");
  }

  const weekly = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();

      d.setDate(d.getDate() - (6 - i));

      const key = `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const sum = foods
        .filter((f) => (f.date || today()) === key)
        .reduce((s, f) => s + num(f.calories), 0);

      return {
        date: key,
        label: d.toLocaleDateString(undefined, {
          weekday: "short"
        }),
        calories: sum
      };
    });
  }, [foods]);

  const maxWeek = Math.max(
    goals.calories,
    ...weekly.map((x) => x.calories),
    1
  );

  return (
    <div className={`app-container ${dark ? "dark-theme" : ""}`}>

      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>

        <div className="brand">
          <div className="brand-icon">
            <Leaf size={23} />
          </div>
          <span>
            fitfuel<span className="brand-dot">.</span>
          </span>
        </div>

        <p className="sidebar-label">MENU</p>

        <nav className="navigation">
          {nav.slice(0, 5).map(([name, Icon]) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              onClick={() => {
                setPage(name);
                setMenuOpen(false);
              }}
            >
              <Icon size={19} />
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <p className="sidebar-label preferences-label">
          PREFERENCES
        </p>

        <button
          className={`nav-item ${page === "Settings" ? "active" : ""}`}
          onClick={() => {
            setPage("Settings");
            setMenuOpen(false);
          }}
        >
          <Settings size={19} />
          <span>Settings</span>
        </button>

        <div className="sidebar-bottom">
          <div className="sidebar-leaf">🌱</div>
          <h3>Small steps, big changes.</h3>
          <p>Your fitness journey starts today.</p>

          <div className="profile">
            <div className="profile-avatar">U</div>
            <div>
              <strong>My Profile</strong>
              <span>Personal account</span>
            </div>
          </div>
        </div>

      </aside>

      <main className="main-content">

        <header className="topbar">

          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Open menu"
          >
            <Menu size={23} />
          </button>

          <div className="breadcrumb">
            My workspace <span>/</span> <strong>{page}</strong>
          </div>

          <button
            className="notification-button"
            onClick={() => setDark((v) => !v)}
            title="Toggle dark mode"
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>

        </header>

        {page === "Dashboard" && (
          <div className="page-content">

            <section className="welcome-section">
              <div>
                <p className="eyebrow">YOUR FITNESS JOURNEY</p>
                <h1>Let's get stronger.</h1>
                <p className="welcome-description">
                  Build healthy habits, one meal at a time.
                </p>
              </div>

              <div className="welcome-illustration">🌿</div>
            </section>

            <div className="section-heading">
              <div>
                <h2>Today's overview</h2>
                <p>Your daily nutrition summary.</p>
              </div>

              <span className="today-badge">
                {dateLabel(today())}
              </span>
            </div>

            <section className="stats-grid">

              {[
                ["Calories", totals.calories, goals.calories, "kcal", Flame, "orange", "orange-fill"],
                ["Protein", totals.protein, goals.protein, "g", Beef, "green", "green-fill"],
                ["Carbohydrates", totals.carbs, goals.carbs, "g", Wheat, "yellow", "yellow-fill"],
                ["Fat", totals.fat, goals.fat, "g", Apple, "purple", "purple-fill"]
              ].map(([label, value, goal, unit, Icon, color, fill]) => (
                <div className="stat-card" key={label}>
                  <div className="stat-top">
                    <span>{label}</span>
                    <div className={`stat-icon ${color}`}>
                      <Icon size={20} />
                    </div>
                  </div>

                  <h2>
                    {Math.round(value * 10) / 10}
                    <span> / {goal} {unit}</span>
                  </h2>

                  <div className="progress-track">
                    <div
                      className={`progress-fill ${fill}`}
                      style={{
                        width: `${Math.min(100, value / goal * 100)}%`
                      }}
                    />
                  </div>

                  <p>
                    {label === "Calories"
                      ? `${Math.max(0, Math.round(goal - value))} kcal remaining`
                      : "Daily target progress"}
                  </p>
                </div>
              ))}

            </section>

            <section className="dashboard-grid">

              <div className="content-card">

                <div className="card-heading">
                  <div>
                    <h3>Today's meals</h3>
                    <p>{todayFoods.length} food item(s) logged</p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setPage("Food Diary")}
                  >
                    Open diary
                  </button>
                </div>

                {todayFoods.length === 0 ? (
                  <div className="meal-placeholder">
                    <div className="placeholder-icon">
                      <Utensils size={25} />
                    </div>

                    <h3>No meals added yet</h3>

                    <p>
                      Start tracking your food to see your nutrition here.
                    </p>

                    <button
                      className="primary-button"
                      onClick={() => setPage("Food Diary")}
                    >
                      <Plus size={17} />
                      Add your first meal
                    </button>
                  </div>
                ) : (
                  <div className="dashboard-food-list">
                    {todayFoods.slice(-7).reverse().map((f) => (
                      <div className="dashboard-food-row" key={f.id}>
                        <div className="dashboard-food-icon">
                          <Utensils size={18} />
                        </div>

                        <div className="dashboard-food-info">
                          <strong>{f.name}</strong>
                          <span>{f.meal || "Meal"}</span>
                        </div>

                        <div className="dashboard-food-calories">
                          {Math.round(num(f.calories))} kcal
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              <div className="content-card water-card">

                <div className="card-heading">
                  <div>
                    <h3>Water tracker</h3>
                    <p>Stay hydrated throughout the day.</p>
                  </div>

                  <div className="water-icon">
                    <Droplets size={20} />
                  </div>
                </div>

                <div className="water-number">
                  {todayWater * 250}
                  <span> / {goals.water * 250} ml</span>
                </div>

                <div className="water-glasses">
                  {Array.from({ length: goals.water }, (_, i) => (
                    <div
                      key={i}
                      className={`water-glass ${i < todayWater ? "filled" : ""}`}
                    >
                      <Droplets size={17} />
                    </div>
                  ))}
                </div>

                <p className="water-caption">
                  {todayWater} of {goals.water} glasses completed
                </p>

                <button
                  className="water-button"
                  onClick={() => changeWater(1)}
                  disabled={todayWater >= goals.water}
                >
                  <Plus size={17} />
                  Add a glass
                </button>

                <button
                  className="reset-water"
                  onClick={() => changeWater(-todayWater)}
                >
                  Reset today's water
                </button>

              </div>

            </section>

          </div>
        )}

        {page === "Food Diary" && (
          <FoodDiary goals={goals} />
        )}

        {page === "Nutrition" && (
          <div className="page-content">

            <div className="page-title">
              <p className="eyebrow">YOUR NUTRITION</p>
              <h1>Nutrition summary</h1>
              <p>Review your recent calorie intake.</p>
            </div>

            <section className="content-card chart-card">
              <div className="card-heading">
                <div>
                  <h3>Last 7 days · Calories</h3>
                  <p>Daily food diary totals compared with your target.</p>
                </div>
              </div>

              <div className="bar-chart">
                {weekly.map((d) => (
                  <div className="bar-column" key={d.date}>
                    <strong>{Math.round(d.calories)}</strong>

                    <div className="bar-area">
                      <div
                        className="bar-target"
                        style={{
                          height: `${goals.calories / maxWeek * 100}%`
                        }}
                      />

                      <div
                        className="bar-value"
                        style={{
                          height: `${Math.max(
                            d.calories ? 3 : 0,
                            d.calories / maxWeek * 100
                          )}%`
                        }}
                      />
                    </div>

                    <span>{d.label}</span>
                  </div>
                ))}
              </div>

              <p className="chart-note">
                Bars show calories logged. The pale marker indicates your daily goal.
              </p>
            </section>

            <section className="stats-grid compact-stats">
              {[
                ["Calories", totals.calories, "kcal"],
                ["Protein", totals.protein, "g"],
                ["Carbs", totals.carbs, "g"],
                ["Fat", totals.fat, "g"]
              ].map(([l, v, u]) => (
                <div className="stat-card" key={l}>
                  <span className="muted">{l} today</span>
                  <h2>{v.toFixed(1)} <small>{u}</small></h2>
                </div>
              ))}
            </section>

          </div>
        )}

        {page === "Workouts" && (
          <div className="page-content">

            <div className="page-title">
              <p className="eyebrow">TRAINING LOG</p>
              <h1>Workouts</h1>
              <p>Record your training sessions.</p>
            </div>

            <div className="diary-layout">

              <form className="content-card form-card" onSubmit={addWorkout}>
                <h3>Log a workout</h3>

                <label>
                  Workout name
                  <input
                    required
                    placeholder="e.g. Push day"
                    value={workout.name}
                    onChange={(e) =>
                      setWorkout({ ...workout, name: e.target.value })
                    }
                  />
                </label>

                <label>
                  Workout type
                  <select
                    value={workout.type}
                    onChange={(e) =>
                      setWorkout({ ...workout, type: e.target.value })
                    }
                  >
                    <option>Strength</option>
                    <option>Cardio</option>
                    <option>Flexibility</option>
                    <option>Sports</option>
                    <option>Other</option>
                  </select>
                </label>

                <label>
                  Duration (minutes)
                  <input
                    type="number"
                    min="0"
                    placeholder="45"
                    value={workout.minutes}
                    onChange={(e) =>
                      setWorkout({ ...workout, minutes: e.target.value })
                    }
                  />
                </label>

                <label>
                  Notes (optional)
                  <textarea
                    rows="3"
                    placeholder="Exercises, sets, how it felt..."
                    value={workout.notes}
                    onChange={(e) =>
                      setWorkout({ ...workout, notes: e.target.value })
                    }
                  />
                </label>

                <button className="primary-button" type="submit">
                  <Plus size={17} />
                  Save workout
                </button>
              </form>

              <section className="content-card">
                <div className="card-heading">
                  <div>
                    <h3>Workout history</h3>
                    <p>{workouts.length} session(s) recorded</p>
                  </div>
                </div>

                {workouts.length === 0 ? (
                  <div className="empty-diary">
                    <Activity size={30} />
                    <p>No workouts logged yet.</p>
                  </div>
                ) : (
                  workouts.map((w) => (
                    <div className="history-row" key={w.id}>
                      <div className="history-icon">
                        <Dumbbell size={19} />
                      </div>

                      <div className="history-main">
                        <strong>{w.name}</strong>
                        <span>
                          {w.type} · {w.minutes || 0} min · {dateLabel(w.date)}
                        </span>
                        {w.notes && <p>{w.notes}</p>}
                      </div>

                      <button
                        className="icon-danger"
                        onClick={() =>
                          setWorkouts((old) =>
                            old.filter((x) => x.id !== w.id)
                          )
                        }
                        aria-label="Delete workout"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))
                )}
              </section>

            </div>
          </div>
        )}

        {page === "Progress" && (
          <div className="page-content">

            <div className="page-title">
              <p className="eyebrow">YOUR JOURNEY</p>
              <h1>Weight progress</h1>
              <p>Log your weight and follow the trend over time.</p>
            </div>

            <div className="diary-layout">

              <form className="content-card form-card" onSubmit={addWeight}>
                <h3>Add weight entry</h3>

                <label>
                  Date
                  <input
                    type="date"
                    max={today()}
                    value={weightDate}
                    onChange={(e) => setWeightDate(e.target.value)}
                  />
                </label>

                <label>
                  Weight (kg)
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    placeholder="e.g. 62.5"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                  />
                </label>

                <button className="primary-button" type="submit">
                  <Plus size={17} />
                  Save weight
                </button>
              </form>

              <section className="content-card">
                <div className="card-heading">
                  <div>
                    <h3>Weight history</h3>
                    <p>{weights.length} entry(s) saved</p>
                  </div>
                  <Scale size={21} />
                </div>

                {weights.length === 0 ? (
                  <div className="empty-diary">
                    <Scale size={30} />
                    <p>Add your first weight entry to start tracking.</p>
                  </div>
                ) : (
                  <>
                    <div className="weight-highlight">
                      <strong>
                        {weights[weights.length - 1].weight} kg
                      </strong>
                      <span>Latest recorded weight</span>
                    </div>

                    {weights.slice().reverse().map((w) => (
                      <div className="history-row" key={w.id}>
                        <div className="history-icon">
                          <CalendarDays size={18} />
                        </div>

                        <div className="history-main">
                          <strong>{w.weight} kg</strong>
                          <span>{dateLabel(w.date)} · {w.date}</span>
                        </div>

                        <button
                          className="icon-danger"
                          onClick={() =>
                            setWeights((old) =>
                              old.filter((x) => x.id !== w.id)
                            )
                          }
                          aria-label="Delete entry"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </section>

            </div>
          </div>
        )}

        {page === "Settings" && (
          <div className="page-content">

            <div className="page-title">
              <p className="eyebrow">PERSONALISE FITFUEL</p>
              <h1>Settings</h1>
              <p>Adjust your daily targets and manage your data.</p>
            </div>

            <div className="settings-grid">

              <form className="content-card form-card" onSubmit={saveGoals}>
                <h3>Daily goals</h3>
                <p className="muted">
                  These are starting targets. Adjust them to suit your plan.
                </p>

                {[
                  ["calories", "Calories (kcal)"],
                  ["protein", "Protein (g)"],
                  ["carbs", "Carbohydrates (g)"],
                  ["fat", "Fat (g)"],
                  ["water", "Water glasses (250 ml each)"]
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min="1"
                      value={goalDraft[key]}
                      onChange={(e) =>
                        setGoalDraft({
                          ...goalDraft,
                          [key]: e.target.value
                        })
                      }
                    />
                  </label>
                ))}

                <button className="primary-button" type="submit">
                  <Save size={17} />
                  Save goals
                </button>
              </form>

              <section className="content-card form-card">
                <h3>Appearance & backup</h3>

                <button
                  className="setting-action"
                  onClick={() => setDark((v) => !v)}
                >
                  {dark ? <Sun size={18} /> : <Moon size={18} />}
                  {dark ? "Switch to light mode" : "Switch to dark mode"}
                </button>

                <button
                  className="setting-action"
                  onClick={exportData}
                >
                  <Download size={18} />
                  Export all FitFuel data
                </button>

                <label className="setting-action file-action">
                  <Upload size={18} />
                  Import FitFuel backup
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={importData}
                  />
                </label>

                <p className="muted">
                  Your information is stored in this browser. Export a backup
                  before clearing browser data or changing devices.
                </p>

                {backupMessage && (
                  <p className="success-message">{backupMessage}</p>
                )}
              </section>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;