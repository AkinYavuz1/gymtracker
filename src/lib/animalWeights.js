const ANIMALS = [
  { name: "Chihuahua", weight: 2, row: 0, col: 0 },
  { name: "House Cat", weight: 4.5, row: 0, col: 1 },
  { name: "Bulldog", weight: 23, row: 1, col: 0 },
  { name: "Labrador", weight: 30, row: 1, col: 1 },
  { name: "German Shepherd", weight: 35, row: 2, col: 0 },
  { name: "Baby Seal", weight: 40, row: 2, col: 1 },
  { name: "Cheetah", weight: 50, row: 3, col: 0 },
  { name: "Giant Panda", weight: 100, row: 4, col: 0 },
  { name: "Reindeer", weight: 120, row: 4, col: 1 },
  { name: "Lion", weight: 190, row: 5, col: 0 },
  { name: "Gorilla", weight: 200, row: 5, col: 1 },
  { name: "Tiger", weight: 220, row: 6, col: 0 },
  { name: "Brown Bear", weight: 350, row: 7, col: 0 },
  { name: "Polar Bear", weight: 450, row: 7, col: 1 },
  { name: "Horse", weight: 500, row: 8, col: 0 },
  { name: "Giraffe", weight: 800, row: 8, col: 1 },
  { name: "Hippo", weight: 1500, row: 9, col: 1 },
  { name: "Rhino", weight: 2300, row: 10, col: 0 },
  { name: "Elephant", weight: 5000, row: 10, col: 1 },
];

export function getAnimalComparison(weightKg) {
  let best = ANIMALS[0];
  for (const animal of ANIMALS) {
    if (animal.weight <= weightKg) best = animal;
    else break;
  }
  return best;
}

export function getAnimalStyle(row, col) {
  return {
    backgroundImage: "url(/animals/sprites/Gemini_Generated_Image_bmsu37bmsu37bmsu.png)",
    backgroundPosition: `${col * 100}% ${(row / 10) * 100}%`,
    backgroundSize: "200% 1100%",
    width: 120,
    height: 120,
  };
}
