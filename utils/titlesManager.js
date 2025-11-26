import fs from 'fs';

const TITLES_FILE = './data/titlesShop.json';

export function loadTitlesShop() {
  try {
    if (!fs.existsSync(TITLES_FILE)) {
      // Crear archivo por defecto si no existe
      const defaultData = { titles: [] };
      fs.writeFileSync(TITLES_FILE, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    return JSON.parse(fs.readFileSync(TITLES_FILE, 'utf8'));
  } catch (error) {
    console.error('Error cargando titlesShop.json:', error);
    return { titles: [] };
  }
}

export function saveTitlesShop(data) {
  try {
    fs.writeFileSync(TITLES_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error guardando titlesShop.json:', error);
    return false;
  }
}

export function getAllTitles() {
  const data = loadTitlesShop();
  return data.titles;
}

export function getTitleById(id) {
  const titles = getAllTitles();
  return titles.find(title => title.id === id);
}

export function getTitleByIndex(index) {
  const titles = getAllTitles();
  return titles[index];
}

export function addNewTitle(titleData) {
  const data = loadTitlesShop();
  
  // Generar ID único si no se proporciona
  const id = titleData.id || `title_${Date.now()}`;
  
  const newTitle = {
    id: id,
    name: titleData.name,
    displayName: titleData.displayName,
    description: "Título comprable creado por owners",
    price: titleData.price,
    emoji: titleData.emoji || "⭐",
    createdBy: titleData.createdBy || "owner"
  };
  
  data.titles.push(newTitle);
  
  if (saveTitlesShop(data)) {
    return { success: true, title: newTitle };
  } else {
    return { success: false, error: "No se pudo guardar el título" };
  }
}
