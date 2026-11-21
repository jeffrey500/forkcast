import type { Ingredient, NutritionFacts } from "./types";

/**
 * Built-in library of easy, healthy lunches and dinners. These are separate
 * from the household's own recipes: browsing them changes nothing, and
 * "Add to our recipes" copies one into the household's recipe box.
 *
 * Quantities are for 2 servings. Only main ingredients are tracked against the
 * fridge; oils, spices and sauces are listed under `pantry` and not tracked.
 */

export type LibraryMeal = "lunch" | "dinner" | "either";

export interface LibraryRecipe {
  id: string;
  name: string;
  description: string;
  meal: LibraryMeal;
  minutes: number;
  servings: number;
  ingredients: Ingredient[];
  pantry: string[];
  steps: string[];
  tags: string[];
  /** Approximate nutrition per serving (built-in estimate). */
  nutrition?: NutritionFacts;
}

const i = (name: string, quantity: number, unit = ""): Ingredient => ({ name, quantity, unit });

export const LIBRARY: LibraryRecipe[] = [
  // ---------------------------------------------------------------- lunch
  {
    id: "chickpea-avocado-wraps",
    name: "Chickpea & avocado smash wraps",
    description: "Creamy, zesty and done in ten minutes. No cooking needed.",
    meal: "lunch",
    minutes: 10,
    servings: 2,
    ingredients: [i("chickpeas", 1, "can"), i("avocado", 1), i("lemon", 1), i("tortilla", 2), i("spinach", 40, "g")],
    pantry: ["salt", "pepper", "chili flakes"],
    steps: [
      "Drain and rinse the chickpeas, then roughly mash them with the avocado.",
      "Stir in the juice of half the lemon, salt, pepper and a pinch of chili flakes.",
      "Spread over the tortillas, add a handful of spinach and roll up.",
    ],
    tags: ["vegetarian", "no-cook", "high-fiber"],
    nutrition: { kcal: 440, protein: 15, carbs: 56, fat: 18 },
  },
  {
    id: "greek-chicken-salad",
    name: "Greek chicken salad bowls",
    description: "Pan-seared chicken over a crunchy cucumber, tomato and feta salad.",
    meal: "lunch",
    minutes: 20,
    servings: 2,
    ingredients: [
      i("chicken breast", 300, "g"),
      i("cucumber", 1),
      i("cherry tomato", 200, "g"),
      i("feta", 60, "g"),
      i("red onion", 0.5),
      i("lemon", 1),
    ],
    pantry: ["olive oil", "dried oregano", "salt", "pepper"],
    steps: [
      "Season the chicken with oregano, salt and pepper. Cook in a little olive oil, 5–6 minutes per side, until cooked through.",
      "Chop the cucumber, halve the tomatoes and thinly slice the onion.",
      "Toss the vegetables with olive oil and lemon juice, then top with sliced chicken and crumbled feta.",
    ],
    tags: ["high-protein", "low-carb"],
    nutrition: { kcal: 410, protein: 41, carbs: 16, fat: 21 },
  },
  {
    id: "tuna-white-bean-salad",
    name: "Tuna & white bean salad",
    description: "A pantry-staple lunch that keeps you full all afternoon.",
    meal: "lunch",
    minutes: 10,
    servings: 2,
    ingredients: [i("tuna", 1, "can"), i("white beans", 1, "can"), i("cherry tomato", 150, "g"), i("red onion", 0.5), i("lemon", 1)],
    pantry: ["olive oil", "salt", "pepper", "parsley (optional)"],
    steps: [
      "Drain the tuna and beans. Halve the tomatoes and finely chop the onion.",
      "Mix everything with a good splash of olive oil and the lemon juice.",
      "Season and serve as it is, or on toast.",
    ],
    tags: ["high-protein", "no-cook", "high-fiber"],
    nutrition: { kcal: 360, protein: 25, carbs: 32, fat: 15 },
  },
  {
    id: "egg-fried-rice",
    name: "Veggie egg fried rice",
    description: "The best use of yesterday's rice. Fast, filling, and full of veg.",
    meal: "either",
    minutes: 15,
    servings: 2,
    ingredients: [i("cooked rice", 2, "cup"), i("egg", 3), i("frozen peas", 150, "g"), i("carrot", 1), i("spring onion", 3)],
    pantry: ["soy sauce", "sesame oil", "neutral oil"],
    steps: [
      "Grate the carrot and slice the spring onions.",
      "Scramble the eggs in a hot oiled pan and set them aside.",
      "Stir-fry the carrot and peas for 2 minutes, add the rice and fry until hot.",
      "Return the eggs, then add soy sauce, a drop of sesame oil and the spring onions.",
    ],
    tags: ["vegetarian", "quick", "budget"],
    nutrition: { kcal: 480, protein: 20, carbs: 61, fat: 18 },
  },
  {
    id: "red-lentil-soup",
    name: "Red lentil & carrot soup",
    description: "Silky, warming and very cheap. Doubles easily for lunches all week.",
    meal: "lunch",
    minutes: 30,
    servings: 2,
    ingredients: [i("red lentils", 150, "g"), i("carrot", 2), i("onion", 1), i("garlic", 2, "clove"), i("chopped tomatoes", 1, "can")],
    pantry: ["olive oil", "ground cumin", "stock cube", "salt", "pepper"],
    steps: [
      "Soften the chopped onion, carrot and garlic in olive oil for 5 minutes.",
      "Add 1 tsp cumin, the lentils, tomatoes, a stock cube and 700 ml water.",
      "Simmer for 20 minutes until the lentils collapse, then blend or leave chunky.",
    ],
    tags: ["vegan", "batch-cook", "high-fiber", "budget"],
    nutrition: { kcal: 440, protein: 22, carbs: 68, fat: 10 },
  },
  {
    id: "mediterranean-quinoa-salad",
    name: "Mediterranean quinoa salad",
    description: "Protein-packed grain salad that tastes even better the next day.",
    meal: "lunch",
    minutes: 20,
    servings: 2,
    ingredients: [
      i("quinoa", 120, "g"),
      i("chickpeas", 1, "can"),
      i("cucumber", 1),
      i("cherry tomato", 200, "g"),
      i("feta", 60, "g"),
      i("lemon", 1),
    ],
    pantry: ["olive oil", "salt", "pepper"],
    steps: [
      "Rinse the quinoa and simmer it in 250 ml water for 15 minutes, then let it cool a little.",
      "Chop the cucumber and tomatoes, and drain the chickpeas.",
      "Toss everything with lemon juice and olive oil, then crumble the feta over the top.",
    ],
    tags: ["vegetarian", "meal-prep", "high-fiber"],
    nutrition: { kcal: 600, protein: 23, carbs: 76, fat: 23 },
  },
  {
    id: "turkey-hummus-pitas",
    name: "Turkey & hummus pita pockets",
    description: "Lean, crunchy and ready in the time it takes to toast a pita.",
    meal: "lunch",
    minutes: 10,
    servings: 2,
    ingredients: [i("pita", 2), i("sliced turkey", 150, "g"), i("hummus", 4, "tbsp"), i("cucumber", 0.5), i("carrot", 1)],
    pantry: ["pepper"],
    steps: [
      "Warm the pitas and open them into pockets.",
      "Spread hummus inside and fill with turkey, cucumber slices and grated carrot.",
    ],
    tags: ["high-protein", "quick"],
    nutrition: { kcal: 320, protein: 23, carbs: 45, fat: 6 },
  },
  {
    id: "black-bean-quesadillas",
    name: "Black bean & pepper quesadillas",
    description: "Crispy, cheesy and secretly full of fiber.",
    meal: "either",
    minutes: 15,
    servings: 2,
    ingredients: [i("tortilla", 4), i("black beans", 1, "can"), i("bell pepper", 1), i("cheddar", 80, "g"), i("salsa", 4, "tbsp")],
    pantry: ["ground cumin", "neutral oil"],
    steps: [
      "Drain the beans, lightly mash them with a pinch of cumin, and dice the pepper.",
      "Spread the beans over half the tortillas, top with pepper and grated cheese, then cover with the rest.",
      "Cook in a lightly oiled pan for 2–3 minutes per side, then cut and serve with salsa.",
    ],
    tags: ["vegetarian", "quick", "high-fiber"],
    nutrition: { kcal: 640, protein: 29, carbs: 80, fat: 23 },
  },
  {
    id: "spinach-feta-omelette",
    name: "Spinach & feta omelette",
    description: "A five-ingredient lunch with loads of protein.",
    meal: "lunch",
    minutes: 10,
    servings: 2,
    ingredients: [i("egg", 4), i("spinach", 60, "g"), i("feta", 40, "g"), i("cherry tomato", 100, "g")],
    pantry: ["olive oil", "salt", "pepper"],
    steps: [
      "Wilt the spinach in a little olive oil, then pour in the beaten, seasoned eggs.",
      "Cook gently until almost set, then add the feta and halved tomatoes.",
      "Fold over and serve. Make two smaller omelettes if your pan is small.",
    ],
    tags: ["vegetarian", "high-protein", "low-carb", "quick"],
    nutrition: { kcal: 250, protein: 17, carbs: 5, fat: 18 },
  },
  {
    id: "peanut-noodle-salad",
    name: "Peanut noodle salad",
    description: "Cold noodles, crunchy veg and a punchy peanut-lime dressing.",
    meal: "lunch",
    minutes: 15,
    servings: 2,
    ingredients: [i("soba noodles", 150, "g"), i("edamame", 100, "g"), i("carrot", 1), i("cucumber", 1), i("peanut butter", 2, "tbsp"), i("lime", 1)],
    pantry: ["soy sauce", "honey", "chili flakes"],
    steps: [
      "Cook the noodles with the edamame for the last 2 minutes, then rinse under cold water.",
      "Whisk the peanut butter, lime juice, 1 tbsp soy sauce, 1 tsp honey and a splash of water.",
      "Toss with the noodles and the shredded carrot and cucumber.",
    ],
    tags: ["vegetarian", "meal-prep"],
    nutrition: { kcal: 470, protein: 23, carbs: 75, fat: 11 },
  },
  {
    id: "cottage-cheese-toast",
    name: "Cottage cheese veggie toast",
    description: "High-protein open sandwiches. A five-minute lunch.",
    meal: "lunch",
    minutes: 5,
    servings: 2,
    ingredients: [i("bread", 4, "slice"), i("cottage cheese", 200, "g"), i("cucumber", 0.5), i("cherry tomato", 100, "g")],
    pantry: ["pepper", "chili flakes"],
    steps: [
      "Toast the bread and spread thickly with cottage cheese.",
      "Top with sliced cucumber and tomatoes, plus a crack of pepper and some chili flakes.",
    ],
    tags: ["vegetarian", "high-protein", "quick"],
    nutrition: { kcal: 290, protein: 19, carbs: 37, fat: 7 },
  },
  {
    id: "miso-tofu-noodle-soup",
    name: "Miso tofu noodle soup",
    description: "Light, savoury and comforting. Ready in fifteen minutes.",
    meal: "lunch",
    minutes: 15,
    servings: 2,
    ingredients: [i("tofu", 200, "g"), i("miso paste", 2, "tbsp"), i("udon noodles", 200, "g"), i("spinach", 50, "g"), i("spring onion", 2)],
    pantry: ["soy sauce"],
    steps: [
      "Bring 800 ml water to a simmer and cook the noodles.",
      "Turn the heat low, then stir in the miso (don't boil it) and add cubed tofu and the spinach.",
      "Season with a dash of soy sauce and top with sliced spring onion.",
    ],
    tags: ["vegan", "quick"],
    nutrition: { kcal: 300, protein: 20, carbs: 35, fat: 8 },
  },
  {
    id: "burrito-bowl",
    name: "Black bean burrito bowls",
    description: "Everything you love about a burrito, in a bowl, with more veg.",
    meal: "either",
    minutes: 20,
    servings: 2,
    ingredients: [
      i("rice", 1, "cup"),
      i("black beans", 1, "can"),
      i("sweetcorn", 150, "g"),
      i("cherry tomato", 150, "g"),
      i("avocado", 1),
      i("lime", 1),
    ],
    pantry: ["ground cumin", "chili powder", "salt"],
    steps: [
      "Cook the rice.",
      "Warm the beans and corn with a pinch each of cumin and chili powder.",
      "Pile onto the rice with chopped tomatoes and avocado, then squeeze lime over the top.",
    ],
    tags: ["vegan", "high-fiber", "meal-prep"],
    nutrition: { kcal: 690, protein: 21, carbs: 126, fat: 13 },
  },
  {
    id: "shakshuka",
    name: "Shakshuka",
    description: "Eggs poached in a spiced pepper and tomato sauce. One pan.",
    meal: "either",
    minutes: 25,
    servings: 2,
    ingredients: [i("egg", 4), i("chopped tomatoes", 1, "can"), i("bell pepper", 1), i("onion", 1), i("garlic", 2, "clove")],
    pantry: ["olive oil", "ground cumin", "paprika", "salt"],
    steps: [
      "Soften the sliced onion and pepper in olive oil for 8 minutes, then add the garlic, 1 tsp cumin and 1 tsp paprika.",
      "Add the tomatoes and simmer for 5 minutes until thick.",
      "Make four wells, crack in the eggs, then cover and cook for 5–7 minutes until the whites set.",
    ],
    tags: ["vegetarian", "high-protein", "one-pan"],
    nutrition: { kcal: 330, protein: 16, carbs: 21, fat: 20 },
  },

  // --------------------------------------------------------------- dinner
  {
    id: "sheet-pan-chicken-veg",
    name: "Sheet-pan chicken & sweet potato",
    description: "Throw it all on a tray and let the oven do the work.",
    meal: "dinner",
    minutes: 35,
    servings: 2,
    ingredients: [i("chicken thigh", 400, "g"), i("sweet potato", 2), i("broccoli", 250, "g"), i("red onion", 1)],
    pantry: ["olive oil", "paprika", "garlic powder", "salt", "pepper"],
    steps: [
      "Heat the oven to 220°C / 425°F.",
      "Cube the sweet potato and cut the onion into wedges. Toss with oil and spices and roast for 10 minutes.",
      "Add the chicken and broccoli, season, and roast for 20 more minutes until the chicken is cooked through.",
    ],
    tags: ["high-protein", "one-pan", "gluten-free"],
    nutrition: { kcal: 635, protein: 46, carbs: 52, fat: 28 },
  },
  {
    id: "lemon-garlic-salmon",
    name: "Lemon-garlic salmon & asparagus",
    description: "Omega-3 rich and on the table in 25 minutes.",
    meal: "dinner",
    minutes: 25,
    servings: 2,
    ingredients: [i("salmon fillet", 2), i("asparagus", 250, "g"), i("baby potato", 400, "g"), i("lemon", 1), i("garlic", 2, "clove")],
    pantry: ["olive oil", "salt", "pepper"],
    steps: [
      "Boil the halved potatoes for 12 minutes, then drain.",
      "Lay the potatoes, asparagus and salmon on a tray. Drizzle with oil, garlic and lemon zest, then season.",
      "Roast at 200°C / 400°F for 12–14 minutes. Squeeze the lemon over before serving.",
    ],
    tags: ["high-protein", "omega-3", "gluten-free"],
    nutrition: { kcal: 535, protein: 35, carbs: 42, fat: 26 },
  },
  {
    id: "turkey-taco-lettuce-wraps",
    name: "Turkey taco lettuce wraps",
    description: "All the taco flavour, light and crunchy.",
    meal: "dinner",
    minutes: 20,
    servings: 2,
    ingredients: [i("ground turkey", 400, "g"), i("romaine lettuce", 1), i("tomato", 2), i("avocado", 1), i("lime", 1)],
    pantry: ["ground cumin", "chili powder", "garlic powder", "neutral oil", "salt"],
    steps: [
      "Brown the turkey in a little oil, breaking it up as it cooks.",
      "Add 1 tsp each of cumin, chili powder and garlic powder, plus a splash of water, and cook for 2 minutes.",
      "Spoon into lettuce leaves and top with diced tomato, avocado and lime.",
    ],
    tags: ["high-protein", "low-carb", "gluten-free"],
    nutrition: { kcal: 495, protein: 42, carbs: 17, fat: 30 },
  },
  {
    id: "chickpea-spinach-curry",
    name: "Chickpea & spinach coconut curry",
    description: "Creamy, mild and plant-based. Great for batch cooking.",
    meal: "dinner",
    minutes: 25,
    servings: 2,
    ingredients: [
      i("chickpeas", 2, "can"),
      i("coconut milk", 1, "can"),
      i("spinach", 150, "g"),
      i("onion", 1),
      i("garlic", 3, "clove"),
      i("rice", 1, "cup"),
    ],
    pantry: ["curry powder", "neutral oil", "salt"],
    steps: [
      "Cook the rice.",
      "Soften the onion and garlic in oil, then stir in 2 tbsp curry powder for 1 minute.",
      "Add the chickpeas and coconut milk, simmer for 10 minutes, then wilt in the spinach.",
    ],
    tags: ["vegan", "batch-cook", "high-fiber", "gluten-free"],
    nutrition: { kcal: 1150, protein: 31, carbs: 147, fat: 51 },
  },
  {
    id: "beef-broccoli-stir-fry",
    name: "Beef & broccoli stir-fry",
    description: "Better than takeout and much lighter.",
    meal: "dinner",
    minutes: 25,
    servings: 2,
    ingredients: [i("beef strips", 350, "g"), i("broccoli", 300, "g"), i("rice", 1, "cup"), i("garlic", 2, "clove"), i("ginger", 15, "g")],
    pantry: ["soy sauce", "cornstarch", "honey", "neutral oil"],
    steps: [
      "Cook the rice. Toss the beef with 1 tbsp soy sauce and 1 tsp cornstarch.",
      "Stir-fry the beef in a very hot oiled pan for 2 minutes, then set aside.",
      "Stir-fry the broccoli with garlic and ginger, adding a splash of water to steam it.",
      "Return the beef with 2 tbsp soy sauce and 1 tsp honey. Toss and serve over rice.",
    ],
    tags: ["high-protein"],
    nutrition: { kcal: 790, protein: 49, carbs: 92, fat: 24 },
  },
  {
    id: "turkey-bolognese",
    name: "Whole-wheat turkey bolognese",
    description: "A lighter take on the classic, with extra veg hidden in the sauce.",
    meal: "dinner",
    minutes: 30,
    servings: 2,
    ingredients: [
      i("whole-wheat spaghetti", 200, "g"),
      i("ground turkey", 300, "g"),
      i("chopped tomatoes", 1, "can"),
      i("onion", 1),
      i("carrot", 1),
      i("garlic", 2, "clove"),
    ],
    pantry: ["olive oil", "dried oregano", "salt", "pepper"],
    steps: [
      "Soften the finely chopped onion, carrot and garlic in olive oil for 5 minutes.",
      "Brown the turkey, then add the tomatoes and oregano. Simmer for 15 minutes.",
      "Meanwhile cook the spaghetti, then toss it with the sauce.",
    ],
    tags: ["high-protein", "high-fiber", "batch-cook"],
    nutrition: { kcal: 725, protein: 46, carbs: 89, fat: 22 },
  },
  {
    id: "garlic-shrimp-zoodles",
    name: "Garlic shrimp with zucchini noodles",
    description: "Fresh, light and ready in fifteen minutes.",
    meal: "dinner",
    minutes: 15,
    servings: 2,
    ingredients: [i("shrimp", 300, "g"), i("zucchini", 3), i("cherry tomato", 200, "g"), i("garlic", 3, "clove"), i("lemon", 1)],
    pantry: ["olive oil", "chili flakes", "salt"],
    steps: [
      "Spiralize or thinly slice the zucchini into ribbons.",
      "Cook the garlic and chili in olive oil for 30 seconds, then add the shrimp and cook until pink.",
      "Add the tomatoes and zucchini and toss for 2 minutes. Finish with lemon.",
    ],
    tags: ["high-protein", "low-carb", "quick", "gluten-free"],
    nutrition: { kcal: 335, protein: 35, carbs: 17, fat: 15 },
  },
  {
    id: "sweet-potato-black-bean-chili",
    name: "Sweet potato & black bean chili",
    description: "Hearty, smoky, plant-based. It freezes brilliantly.",
    meal: "dinner",
    minutes: 35,
    servings: 2,
    ingredients: [
      i("sweet potato", 1),
      i("black beans", 1, "can"),
      i("chopped tomatoes", 1, "can"),
      i("onion", 1),
      i("bell pepper", 1),
    ],
    pantry: ["olive oil", "chili powder", "ground cumin", "smoked paprika", "salt"],
    steps: [
      "Soften the onion and pepper in oil, then stir in 1 tsp each of the spices.",
      "Add the cubed sweet potato, the tomatoes and 200 ml water. Simmer for 20 minutes.",
      "Add the drained beans and cook for 5 minutes more.",
    ],
    tags: ["vegan", "batch-cook", "high-fiber", "gluten-free"],
    nutrition: { kcal: 400, protein: 16, carbs: 68, fat: 9 },
  },
  {
    id: "teriyaki-tofu-bowls",
    name: "Teriyaki tofu bowls",
    description: "Crispy tofu in a sticky sauce, over rice with greens.",
    meal: "dinner",
    minutes: 25,
    servings: 2,
    ingredients: [i("tofu", 400, "g"), i("rice", 1, "cup"), i("broccoli", 200, "g"), i("carrot", 1), i("spring onion", 2)],
    pantry: ["soy sauce", "honey", "garlic powder", "cornstarch", "neutral oil"],
    steps: [
      "Cook the rice. Press and cube the tofu, then toss it in 1 tbsp cornstarch.",
      "Pan-fry the tofu until golden. Steam the broccoli and slice the carrot.",
      "Stir 3 tbsp soy sauce, 1 tbsp honey and a pinch of garlic powder into the tofu until sticky. Serve over the rice.",
    ],
    tags: ["vegetarian", "high-protein"],
    nutrition: { kcal: 810, protein: 38, carbs: 102, fat: 29 },
  },
  {
    id: "baked-cod-tomatoes",
    name: "Baked cod with tomatoes & olives",
    description: "Mediterranean one-tray fish with almost no washing-up.",
    meal: "dinner",
    minutes: 25,
    servings: 2,
    ingredients: [i("cod fillet", 2), i("cherry tomato", 250, "g"), i("olives", 60, "g"), i("zucchini", 1), i("lemon", 1)],
    pantry: ["olive oil", "dried oregano", "salt", "pepper"],
    steps: [
      "Heat the oven to 200°C / 400°F. Toss the tomatoes, olives and sliced zucchini with oil and oregano.",
      "Roast for 10 minutes, then nestle in the seasoned cod.",
      "Roast for 10–12 more minutes and serve with lemon wedges.",
    ],
    tags: ["high-protein", "low-carb", "one-pan", "gluten-free"],
    nutrition: { kcal: 300, protein: 29, carbs: 12, fat: 16 },
  },
  {
    id: "chicken-fajita-traybake",
    name: "Chicken fajita traybake",
    description: "Sizzling peppers and chicken, wrapped up at the table.",
    meal: "dinner",
    minutes: 30,
    servings: 2,
    ingredients: [
      i("chicken breast", 350, "g"),
      i("bell pepper", 2),
      i("red onion", 1),
      i("tortilla", 4),
      i("greek yogurt", 100, "g"),
      i("lime", 1),
    ],
    pantry: ["olive oil", "smoked paprika", "ground cumin", "chili powder", "salt"],
    steps: [
      "Heat the oven to 220°C / 425°F.",
      "Slice the chicken, peppers and onion. Toss with oil and 1 tsp of each spice.",
      "Roast for 20 minutes. Serve in warm tortillas with yogurt and lime.",
    ],
    tags: ["high-protein", "one-pan"],
    nutrition: { kcal: 700, protein: 56, carbs: 67, fat: 23 },
  },
  {
    id: "quinoa-stuffed-peppers",
    name: "Quinoa & black bean stuffed peppers",
    description: "Colourful, filling and great for leftovers.",
    meal: "dinner",
    minutes: 40,
    servings: 2,
    ingredients: [
      i("bell pepper", 4),
      i("quinoa", 100, "g"),
      i("black beans", 1, "can"),
      i("sweetcorn", 100, "g"),
      i("cheddar", 60, "g"),
    ],
    pantry: ["ground cumin", "chili powder", "salt"],
    steps: [
      "Heat the oven to 200°C / 400°F. Cook the quinoa in 200 ml water for 15 minutes.",
      "Mix the quinoa with the beans, corn, spices and half the cheese.",
      "Halve the peppers, fill them, top with the rest of the cheese and bake for 20 minutes.",
    ],
    tags: ["vegetarian", "high-fiber", "meal-prep", "gluten-free"],
    nutrition: { kcal: 585, protein: 29, carbs: 87, fat: 15 },
  },
  {
    id: "lemon-herb-chicken-couscous",
    name: "Lemon herb chicken & couscous",
    description: "Bright, fresh and on the table in under half an hour.",
    meal: "dinner",
    minutes: 25,
    servings: 2,
    ingredients: [i("chicken breast", 350, "g"), i("couscous", 150, "g"), i("cucumber", 1), i("cherry tomato", 200, "g"), i("lemon", 1)],
    pantry: ["olive oil", "dried oregano", "stock cube", "salt", "pepper"],
    steps: [
      "Season the chicken with oregano, lemon zest, salt and pepper. Pan-fry for 5–6 minutes per side.",
      "Pour 200 ml hot stock over the couscous, cover for 5 minutes, then fluff it up.",
      "Stir in the chopped cucumber, tomatoes and lemon juice. Top with the sliced chicken.",
    ],
    tags: ["high-protein", "quick"],
    nutrition: { kcal: 635, protein: 52, carbs: 69, fat: 16 },
  },
  {
    id: "pesto-gnocchi-greens",
    name: "Pesto gnocchi with peas & spinach",
    description: "Pan-crisped gnocchi tossed with greens. A fifteen-minute dinner.",
    meal: "dinner",
    minutes: 15,
    servings: 2,
    ingredients: [i("gnocchi", 500, "g"), i("pesto", 4, "tbsp"), i("frozen peas", 150, "g"), i("spinach", 100, "g"), i("parmesan", 30, "g")],
    pantry: ["olive oil"],
    steps: [
      "Pan-fry the gnocchi in a little olive oil until golden, about 6–8 minutes.",
      "Add the peas and a splash of water and cook for 2 minutes, then stir in the spinach to wilt.",
      "Take off the heat, stir through the pesto and top with grated parmesan.",
    ],
    tags: ["vegetarian", "quick"],
    nutrition: { kcal: 720, protein: 22, carbs: 97, fat: 27 },
  },
  {
    id: "turkey-meatballs-tomato",
    name: "Turkey meatballs in tomato sauce",
    description: "Tender baked meatballs in an easy sauce. Good with pasta or salad.",
    meal: "dinner",
    minutes: 30,
    servings: 2,
    ingredients: [
      i("ground turkey", 400, "g"),
      i("egg", 1),
      i("breadcrumbs", 40, "g"),
      i("chopped tomatoes", 1, "can"),
      i("garlic", 2, "clove"),
      i("spinach", 80, "g"),
    ],
    pantry: ["olive oil", "dried oregano", "salt", "pepper"],
    steps: [
      "Mix the turkey, egg, breadcrumbs, salt and pepper. Roll into 12 balls and bake at 200°C / 400°F for 15 minutes.",
      "Meanwhile simmer the garlic, tomatoes and oregano for 10 minutes.",
      "Add the meatballs and spinach to the sauce and simmer for 5 minutes.",
    ],
    tags: ["high-protein", "batch-cook"],
    nutrition: { kcal: 530, protein: 47, carbs: 25, fat: 27 },
  },
  {
    id: "honey-garlic-chicken-greens",
    name: "Honey-garlic chicken with green beans",
    description: "Sticky, savoury chicken thighs with crisp beans and rice.",
    meal: "dinner",
    minutes: 30,
    servings: 2,
    ingredients: [i("chicken thigh", 400, "g"), i("green beans", 250, "g"), i("rice", 1, "cup"), i("garlic", 3, "clove")],
    pantry: ["honey", "soy sauce", "neutral oil"],
    steps: [
      "Cook the rice. Sear the chicken thighs in oil for 6 minutes per side.",
      "Add the garlic, 2 tbsp honey and 3 tbsp soy sauce, then simmer until sticky and the chicken is cooked through.",
      "Steam or blanch the green beans for 4 minutes and serve everything together.",
    ],
    tags: ["high-protein"],
    nutrition: { kcal: 805, protein: 49, carbs: 103, fat: 21 },
  },
];

export const MEAL_LABEL: Record<LibraryMeal, string> = {
  lunch: "Lunch",
  dinner: "Dinner",
  either: "Lunch or dinner",
};

const WHOLE_UNITS = new Set(["", "can", "clove", "slice"]);

/** Turn a library recipe into a household recipe for `servings` people. */
export function libraryToRecipe(r: LibraryRecipe, servings: number) {
  const factor = servings / r.servings;
  const ingredients = r.ingredients.map((ing) => {
    const q = ing.quantity * factor;
    const quantity = WHOLE_UNITS.has(ing.unit)
      ? Math.ceil(q * 2 - 1e-9) / 2 // eggs, cans, cloves: nearest half, rounded up
      : q >= 20
        ? Math.round(q / 5) * 5 // grams / ml: nearest 5
        : Math.round(q * 100) / 100;
    return { ...ing, quantity };
  });
  const steps = r.steps.map((s, n) => `${n + 1}. ${s}`).join("\n");
  return {
    name: r.name,
    description: r.description,
    servings,
    ingredients,
    instructions: r.pantry.length ? `${steps}\n\nFrom the pantry: ${r.pantry.join(", ")}.` : steps,
    tags: [...r.tags, ...(r.meal === "either" ? ["lunch", "dinner"] : [r.meal])].slice(0, 12),
    libraryId: r.id,
    // Per-serving values don't change when the recipe is rescaled.
    ...(r.nutrition ? { nutrition: { ...r.nutrition, source: "library" as const } } : {}),
  };
}

/** Per-serving calories for a library recipe, if known. */
export function libraryKcal(r: LibraryRecipe): number | null {
  return r.nutrition?.kcal ?? null;
}
