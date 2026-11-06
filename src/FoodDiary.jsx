import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Trash2,
  Utensils,
  X,
  Heart,
  Barcode,
  Camera,
  CalendarDays,
  LoaderCircle
} from "lucide-react";

const STORAGE_KEY = "fitfuel-food-diary";
const FAV_KEY = "fitfuel-favorite-foods";
const MEAL_KEY = "fitfuel-saved-meals";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const foods = [
  { name: "Boiled rice (100g)", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: "Chicken breast (100g)", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: "Boiled egg", calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3 },
  { name: "Banana", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: "Milk (250ml)", calories: 150, protein: 8, carbs: 12, fat: 8 },
  { name: "Oats (100g)", calories: 389, protein: 16.9, carbs: 66, fat: 6.9 },
  { name: "Almonds (30g)", calories: 174, protein: 6.4, carbs: 6.1, fat: 15 },
  { name: "Chapati", calories: 120, protein: 3.5, carbs: 18, fat: 3 },
  { name: "Idli", calories: 58, protein: 2, carbs: 12, fat: 0.4 },
  { name: "Dosa", calories: 168, protein: 4, carbs: 28, fat: 4 },
  { name: "Sambar (1 bowl)", calories: 110, protein: 5, carbs: 16, fat: 3 },
  { name: "Curd (100g)", calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3 }
];

function FoodDiary({ goals = { calories: 2500 } }) {
  const [diary, setDiary] = useState(() =>
    read(STORAGE_KEY, []).map((f) => ({
      ...f,
      date: f.date || today()
    }))
  );

  const [search, setSearch] = useState("");
  const [meal, setMeal] = useState("Breakfast");
  const [selectedDate, setSelectedDate] = useState(today());
  const [showCustom, setShowCustom] = useState(false);

  const [custom, setCustom] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: ""
  });

  const [favorites, setFavorites] = useState(() =>
    read(FAV_KEY, [])
  );

  const [savedMeals, setSavedMeals] = useState(() =>
    read(MEAL_KEY, [])
  );

  const [barcode, setBarcode] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [photoName, setPhotoName] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diary));
    window.dispatchEvent(new Event("fitfuel-food-updated"));
  }, [diary]);

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(MEAL_KEY, JSON.stringify(savedMeals));
  }, [savedMeals]);

  const selectedFoods = diary.filter(
    (f) => f.date === selectedDate
  );

  const totals = selectedFoods.reduce(
    (a, f) => ({
      calories: a.calories + (Number(f.calories) || 0),
      protein: a.protein + (Number(f.protein) || 0),
      carbs: a.carbs + (Number(f.carbs) || 0),
      fat: a.fat + (Number(f.fat) || 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const filtered = useMemo(
    () =>
      foods.filter((f) =>
        f.name.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  function addFood(food) {
    setDiary((old) => [
      ...old,
      {
        ...food,
        id: Date.now() + Math.random(),
        meal,
        date: selectedDate
      }
    ]);
  }

  function removeFood(id) {
    setDiary((old) => old.filter((f) => f.id !== id));
  }

  function toggleFavorite(food) {
    setFavorites((old) =>
      old.some((x) => x.name === food.name)
        ? old.filter((x) => x.name !== food.name)
        : [...old, food]
    );
  }

  function addCustom(e) {
    e.preventDefault();

    if (!custom.name.trim() || custom.calories === "") {
      return;
    }

    addFood({
      ...custom,
      name: custom.name.trim(),
      calories: Number(custom.calories) || 0,
      protein: Number(custom.protein) || 0,
      carbs: Number(custom.carbs) || 0,
      fat: Number(custom.fat) || 0
    });

    setCustom({
      name: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: ""
    });

    setShowCustom(false);
  }

  async function lookupBarcode(e) {
    e.preventDefault();

    if (!barcode.trim()) return;

    setLookupBusy(true);
    setLookupMessage("");

    try {
      const r = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode.trim())}.json`
      );

      const j = await r.json();

      if (j.status !== 1 || !j.product) {
        throw new Error("Product not found. Try another barcode.");
      }

      const p = j.product;
      const n = p.product_name || p.product_name_en || "Scanned product";
      const k = p.nutriments || {};

      const per100 =
        k["energy-kcal_100g"] ??
        (k["energy_100g"] ? k["energy_100g"] / 4.184 : 0);

      const item = {
        name: `${n} (100g)`,
        calories: Math.round(per100 || 0),
        protein: Number(k.proteins_100g) || 0,
        carbs: Number(k.carbohydrates_100g) || 0,
        fat: Number(k.fat_100g) || 0
      };

      addFood(item);
      setLookupMessage(`Added ${n} using values per 100g.`);
      setBarcode("");
    } catch (err) {
      setLookupMessage(
        err.message || "Could not look up this barcode."
      );
    } finally {
      setLookupBusy(false);
    }
  }

  function saveMeal() {
    if (!selectedFoods.length) return;

    const name = window.prompt("Name this saved meal:");

    if (!name?.trim()) return;

    setSavedMeals((old) => [
      ...old,
      {
        id: Date.now(),
        name: name.trim(),
        items: selectedFoods.map(
          ({ name, calories, protein, carbs, fat }) => ({
            name,
            calories,
            protein,
            carbs,
            fat,
            meal
          })
        )
      }
    ]);
  }

  function addSavedMeal(m) {
    setDiary((old) => [
      ...old,
      ...m.items.map((f, i) => ({
        ...f,
        id: Date.now() + i + Math.random(),
        date: selectedDate
      }))
    ]);
  }

  const goal = numGoal(goals.calories, 2500);

  return (
    <div className="page-content food-diary">
      <div className="diary-heading">
        <div>
          <p className="eyebrow">NUTRITION TRACKING</p>
          <h1>Food diary</h1>
          <p>Log meals, check your nutrition and review previous days.</p>
        </div>

        <div className="diary-date">
          <CalendarDays size={15} />
          <input
            type="date"
            max={today()}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <section className="diary-total">
        <div>
          <p>Calories consumed</p>
          <h2>
            {Math.round(totals.calories)} <span>kcal</span>
          </h2>
          <span className="daily-goal">
            Daily goal: {goal.toLocaleString()} kcal
          </span>
        </div>

        <div className="calorie-circle">
          <span>{Math.round((totals.calories / goal) * 100)}%</span>
          <small>of goal</small>
        </div>
      </section>

      <section className="nutrition-summary">
        {[
          ["Protein", totals.protein],
          ["Carbs", totals.carbs],
          ["Fat", totals.fat]
        ].map(([l, v]) => (
          <div className="nutrition-box" key={l}>
            <span>{l}</span>
            <strong>{v.toFixed(1)}g</strong>
          </div>
        ))}
      </section>

      <div className="diary-layout">
        <section className="content-card food-search-panel">
          <div className="card-heading">
            <div>
              <h3>Add food</h3>
              <p>Choose a meal, then search for food.</p>
            </div>
          </div>

          <div className="meal-selector">
            {["Breakfast", "Lunch", "Snacks", "Dinner"].map((x) => (
              <button
                key={x}
                className={
                  meal === x
                    ? "meal-option selected"
                    : "meal-option"
                }
                onClick={() => setMeal(x)}
              >
                {x}
              </button>
            ))}
          </div>

          <div className="search-box">
            <Search size={19} />
            <input
              placeholder="Search built-in foods..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="food-results">
            {filtered.length ? (
              filtered.map((f) => (
                <div className="food-result" key={f.name}>
                  <div className="food-result-icon">
                    <Utensils size={19} />
                  </div>

                  <div className="food-result-info">
                    <strong>{f.name}</strong>
                    <span>
                      {f.calories} kcal · P {f.protein}g · C {f.carbs}g · F {f.fat}g
                    </span>
                  </div>

                  <button
                    className="favorite-button"
                    onClick={() => toggleFavorite(f)}
                    title="Favorite"
                  >
                    <Heart
                      size={16}
                      fill={
                        favorites.some((x) => x.name === f.name)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>

                  <button
                    className="add-food-button"
                    onClick={() => addFood(f)}
                    aria-label={`Add ${f.name}`}
                  >
                    <Plus size={19} />
                  </button>
                </div>
              ))
            ) : (
              <p className="no-results">
                No matching food in the built-in list.
              </p>
            )}
          </div>

          <button
            className="custom-food-button"
            onClick={() => setShowCustom((v) => !v)}
          >
            <Plus size={17} /> Add custom food
          </button>

          {showCustom && (
            <form className="custom-food-form" onSubmit={addCustom}>
              <div className="custom-form-heading">
                <strong>Add your own food</strong>
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <input
                placeholder="Food name"
                required
                value={custom.name}
                onChange={(e) =>
                  setCustom({ ...custom, name: e.target.value })
                }
              />

              <input
                type="number"
                min="0"
                placeholder="Calories (required)"
                required
                value={custom.calories}
                onChange={(e) =>
                  setCustom({ ...custom, calories: e.target.value })
                }
              />

              <div className="custom-macros">
                {["protein", "carbs", "fat"].map((k) => (
                  <input
                    key={k}
                    type="number"
                    min="0"
                    step=".1"
                    placeholder={`${k} (g)`}
                    value={custom[k]}
                    onChange={(e) =>
                      setCustom({ ...custom, [k]: e.target.value })
                    }
                  />
                ))}
              </div>

              <button className="primary-button" type="submit">
                Add to diary
              </button>
            </form>
          )}

          <div className="barcode-panel">
            <h3>
              <Barcode size={18} /> Barcode lookup
            </h3>
            <p>
              Look up packaged foods in the free Open Food Facts database.
            </p>

            <form className="barcode-form" onSubmit={lookupBarcode}>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Enter barcode number"
              />

              <button className="primary-button" disabled={lookupBusy}>
                {lookupBusy ? (
                  <LoaderCircle size={16} />
                ) : (
                  <Search size={16} />
                )}
                Find
              </button>
            </form>

            {lookupMessage && (
              <p className="lookup-message">{lookupMessage}</p>
            )}
          </div>

          <div className="barcode-panel">
            <h3>
              <Camera size={18} /> Food photo
            </h3>

            <p>
              Choose a food photo as a reminder, then enter the food manually.
              Automatic AI food recognition is not enabled in this free offline version.
            </p>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) =>
                setPhotoName(e.target.files?.[0]?.name || "")
              }
            />

            {photoName && (
              <p className="lookup-message">
                Selected: {photoName}
              </p>
            )}
          </div>

          {favorites.length > 0 && (
            <div className="saved-meals">
              <h3>
                <Heart size={17} /> Favorite foods
              </h3>

              {favorites.map((f) => (
                <div className="saved-food-row" key={f.name}>
                  <span>{f.name}</span>
                  <button
                    className="add-food-button"
                    onClick={() => addFood(f)}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="content-card diary-list-panel">
          <div className="card-heading">
            <div>
              <h3>
                {selectedDate === today()
                  ? "Today's food log"
                  : `Food log · ${selectedDate}`}
              </h3>
              <p>{selectedFoods.length} item(s) added</p>
            </div>

            <button
              className="text-button"
              onClick={saveMeal}
              disabled={!selectedFoods.length}
            >
              Save meal
            </button>
          </div>

          {selectedFoods.length === 0 ? (
            <div className="empty-diary">
              <div className="placeholder-icon">
                <Utensils size={25} />
              </div>
              <h3>Your diary is empty</h3>
              <p>Add food from the list to see it here.</p>
            </div>
          ) : (
            <div className="diary-food-list">
              {["Breakfast", "Lunch", "Snacks", "Dinner"].map((m) => {
                const items = selectedFoods.filter((f) => f.meal === m);

                if (!items.length) return null;

                return (
                  <div className="logged-meal" key={m}>
                    <h4>{m}</h4>

                    {items.map((f) => (
                      <div className="logged-food" key={f.id}>
                        <div>
                          <strong>{f.name}</strong>
                          <span>
                            {f.calories} kcal · P {num(f.protein)}g · C {num(f.carbs)}g · F {num(f.fat)}g
                          </span>
                        </div>

                        <button
                          onClick={() => removeFood(f.id)}
                          aria-label="Remove food"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {savedMeals.length > 0 && (
            <div className="saved-meals">
              <h3>Saved meals</h3>

              {savedMeals.map((m) => (
                <div className="saved-food-row" key={m.id}>
                  <span>
                    {m.name} · {m.items.length} items
                  </span>

                  <button
                    className="add-food-button"
                    onClick={() => addSavedMeal(m)}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function numGoal(value, fallback) {
  const n = Number(value);
  return n > 0 ? n : fallback;
}

function num(value) {
  return Number(value) || 0;
}

export default FoodDiary;