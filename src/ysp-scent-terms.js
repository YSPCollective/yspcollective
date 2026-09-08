/**
 * YSP Collective — Scent vocabulary translations
 *
 * Fragrance notes, accords and family words are a closed vocabulary drawn from
 * product frontmatter, so they are translated by lookup rather than by giving
 * every product its own translated copy.
 *
 * notes   — exact match on the note name as written in frontmatter, case
 *           insensitive. Includes the handful of misspellings currently in the
 *           data (Beramot, Ambergis, Pathcouli, Pathouli, White Must) so they
 *           still translate; fix the source and these entries become harmless.
 * accords — exact match on the lowercase accord name.
 * family  — word-level substitution, since fragrance_family is a free
 *           combination like "Woody Oriental Oud".
 */
(function () {
  'use strict';

  var TERMS = {
    pt: {
      notes: {
        "Agarwood": "Oud", "Akigalawood": "Akigalawood", "Almond": "Amêndoa",
        "Amber": "Âmbar", "Ambergis": "Âmbar cinzento", "Ambergris": "Âmbar cinzento",
        "Amberwood": "Amberwood", "Ambroxan": "Ambroxan", "Angelica Root": "Raiz de angélica",
        "Apple": "Maçã", "Aquatic notes": "Notas aquáticas", "Artemisia": "Artemísia",
        "Basil": "Manjericão", "Benzoin": "Benjoim", "Beramot": "Bergamota",
        "Bergamot": "Bergamota", "Birch": "Bétula", "Bitter Orange": "Laranja amarga",
        "Black Currant": "Groselha preta", "Black Pepper": "Pimenta preta",
        "Blackcurrant": "Groselha preta", "Blue Tea": "Chá azul",
        "Bourbon Vanilla": "Baunilha bourbon", "Bulgarian Rose": "Rosa búlgara",
        "Cacao": "Cacau", "Caramel": "Caramelo", "Cardamom": "Cardamomo",
        "Carrot Seed": "Semente de cenoura", "Cashmeran": "Cashmeran",
        "Cedar": "Cedro", "Cedarwood": "Madeira de cedro", "Cherry": "Cereja",
        "Chestnut": "Castanha", "Cinnamon": "Canela", "Citron": "Cidra",
        "Citrus Notes": "Notas cítricas", "Citruses": "Cítricos", "Coconut": "Coco",
        "Coconut Milk": "Leite de coco", "Coffee": "Café", "Cognac": "Conhaque",
        "Coriander": "Coentro", "Cypriol": "Cypriol", "Dark Chocolate": "Chocolate negro",
        "Dates": "Tâmaras", "Elemi": "Elemi", "Fig": "Figo", "Fir Balsam": "Bálsamo de abeto",
        "Floral Notes": "Notas florais", "Freesia": "Frésia", "Fresh Notes": "Notas frescas",
        "Fruity Notes": "Notas frutadas", "Galbanum": "Gálbano", "Gardenia": "Gardénia",
        "Geranium": "Gerânio", "Ginger": "Gengibre", "Gourmand Accord": "Acorde gourmand",
        "Grapefruit": "Toranja", "Green Mandarin": "Tangerina verde",
        "Green Tangerine": "Tangerina verde", "Guaiac Wood": "Madeira de guaiaco",
        "Guava": "Goiaba", "Heliotrope": "Heliotrópio", "Hibiscus": "Hibisco",
        "Himalayan Nard (Jatamansi)": "Nardo dos Himalaias (Jatamansi)", "Honey": "Mel",
        "Incense": "Incenso", "Indonesian Vetiver Oil": "Óleo de vetiver da Indonésia",
        "Jasmine": "Jasmim", "Kumquat": "Kumquat", "Labdanum": "Ládano",
        "Lavender": "Alfazema", "Leather": "Couro", "Lemon": "Limão",
        "Lemongrass": "Erva-príncipe", "Licorice": "Alcaçuz",
        "Lily of the Valley": "Lírio-do-vale", "Lily-of-the-Valley": "Lírio-do-vale",
        "Lime": "Lima", "Litchi": "Lichia", "Mahonial": "Mahonial",
        "Mandarin": "Tangerina", "Mandarin Orange": "Tangerina", "Mango": "Manga",
        "Marigold": "Calêndula", "Marine Notes": "Notas marinhas", "Marshmallow": "Marshmallow",
        "May Rose": "Rosa de maio", "Milk": "Leite", "Mint": "Hortelã",
        "Molasses": "Melaço", "Moss": "Musgo", "Musk": "Almíscar", "Myrrh": "Mirra",
        "Nashi Pear": "Pera nashi", "Neroli": "Néroli", "Nutmeg": "Noz-moscada",
        "Oak moss": "Musgo de carvalho", "Oakmoss": "Musgo de carvalho",
        "Oakwood": "Madeira de carvalho", "Olibanum": "Olíbano", "Orange": "Laranja",
        "Orange Blossom": "Flor de laranjeira", "Orchid": "Orquídea", "Osmanthus": "Osmanto",
        "Oud": "Oud", "Oud Wood": "Madeira de oud", "Palo Santo": "Palo santo",
        "Patchouli": "Patchouli", "Pathcouli": "Patchouli", "Pathouli": "Patchouli",
        "Peach": "Pêssego", "Pear": "Pera", "Pineapple": "Ananás",
        "Pink Berry": "Bagas rosadas", "Pink Pepper": "Pimenta rosa",
        "Pistachio": "Pistácio", "Plum": "Ameixa", "Powdery Notes": "Notas apolvilhadas",
        "Praline": "Praliné", "Raspberry": "Framboesa", "Red Berries": "Frutos vermelhos",
        "Rhubarb": "Ruibarbo", "Rose": "Rosa", "Rosemary": "Alecrim", "Rum": "Rum",
        "Saffron": "Açafrão", "Sage": "Salva", "Sandalwood": "Sândalo",
        "Spices": "Especiarias", "Strawberry": "Morango",
        "Strawberry Fizz Candy": "Rebuçado efervescente de morango",
        "Strawberry S'mores": "Morango com marshmallow tostado", "Suede": "Camurça",
        "Sugar": "Açúcar", "Sugar Cane": "Cana-de-açúcar", "Sweet Orange": "Laranja doce",
        "Taif Rose": "Rosa de Taif", "Tangerine": "Tangerina", "Tobacco": "Tabaco",
        "Tobacco Leaf": "Folha de tabaco", "Tonka Bean": "Fava tonka",
        "Tonka Beans": "Favas tonka", "Tonkin Musk": "Almíscar Tonkin",
        "Tropical Fruits": "Frutos tropicais", "Tuberose": "Tuberosa",
        "Vanilla": "Baunilha", "Vanilla Syrup": "Xarope de baunilha", "Vetiver": "Vetiver",
        "Violet": "Violeta", "Violet Leaf": "Folha de violeta", "Watermelon": "Melancia",
        "Watery Notes": "Notas aquosas", "Whipped Cream": "Chantilly",
        "White Flowers": "Flores brancas", "White Musk": "Almíscar branco",
        "White Must": "Almíscar branco", "Wood": "Madeira", "Woodsy Notes": "Notas amadeiradas",
        "Woody Notes": "Notas amadeiradas", "Ylang Ylang": "Ylang-ylang"
      },
      accords: {
        "amber": "âmbar", "ambroxan": "ambroxan", "aquatic": "aquático",
        "aromatic": "aromático", "birch": "bétula", "candy": "rebuçado",
        "caramel": "caramelo", "chocolate": "chocolate", "cinnamon": "canela",
        "citrus": "cítrico", "clean": "limpo", "coconut": "coco", "coffee": "café",
        "creamy": "cremoso", "dark": "escuro", "earthy": "terroso", "fig": "figo",
        "floral": "floral", "fresh": "fresco", "fresh spicy": "especiado fresco",
        "fructured": "frutado", "fruity": "frutado", "ginger": "gengibre",
        "gourmand": "gourmand", "grapefruit": "toranja", "green": "verde",
        "honey": "mel", "incense": "incenso", "lactonic": "lactónico",
        "lavender": "alfazema", "leather": "couro", "mango": "manga",
        "marine": "marinho", "metallic": "metálico", "mint": "hortelã",
        "mossy": "musgoso", "musk": "almíscar", "musked": "almiscarado",
        "musky": "almiscarado", "oriental": "oriental", "oud": "oud",
        "ozonic": "ozónico", "patchouli": "patchouli", "peach": "pêssego",
        "plum": "ameixa", "powdery": "apolvilhado", "resinous": "resinoso",
        "rose": "rosa", "rum": "rum", "saffron": "açafrão", "salty": "salgado",
        "sandalwood": "sândalo", "smoked": "fumado", "smoky": "fumado",
        "spicy": "especiado", "strawberry": "morango", "sweet": "doce",
        "terpenic": "terpénico", "tobacco": "tabaco", "tonka": "tonka",
        "tropical": "tropical", "tuberose": "tuberosa", "vanilla": "baunilha",
        "warm": "quente", "warm spicy": "especiado quente", "watermelon": "melancia",
        "white floral": "floral branco", "woody": "amadeirado"
      },
      family: {
        "Amber": "Âmbar", "Aquatic": "Aquático", "Aromatic": "Aromático",
        "Citrus": "Cítrico", "Floral": "Floral", "Fougère": "Fougère",
        "Fresh": "Fresco", "Fruity": "Frutado", "Gourmand": "Gourmand",
        "Green": "Verde", "Marine": "Marinho", "Oriental": "Oriental",
        "Oud": "Oud", "Smoky": "Fumado", "Spicy": "Especiado", "Sweet": "Doce",
        "Tropical": "Tropical", "Vanilla": "Baunilha", "Woody": "Amadeirado"
      }
    },

    es: {
      notes: {
        "Agarwood": "Oud", "Akigalawood": "Akigalawood", "Almond": "Almendra",
        "Amber": "Ámbar", "Ambergis": "Ámbar gris", "Ambergris": "Ámbar gris",
        "Amberwood": "Amberwood", "Ambroxan": "Ambroxan", "Angelica Root": "Raíz de angélica",
        "Apple": "Manzana", "Aquatic notes": "Notas acuáticas", "Artemisia": "Artemisa",
        "Basil": "Albahaca", "Benzoin": "Benjuí", "Beramot": "Bergamota",
        "Bergamot": "Bergamota", "Birch": "Abedul", "Bitter Orange": "Naranja amarga",
        "Black Currant": "Grosella negra", "Black Pepper": "Pimienta negra",
        "Blackcurrant": "Grosella negra", "Blue Tea": "Té azul",
        "Bourbon Vanilla": "Vainilla bourbon", "Bulgarian Rose": "Rosa búlgara",
        "Cacao": "Cacao", "Caramel": "Caramelo", "Cardamom": "Cardamomo",
        "Carrot Seed": "Semilla de zanahoria", "Cashmeran": "Cashmeran",
        "Cedar": "Cedro", "Cedarwood": "Madera de cedro", "Cherry": "Cereza",
        "Chestnut": "Castaña", "Cinnamon": "Canela", "Citron": "Cidra",
        "Citrus Notes": "Notas cítricas", "Citruses": "Cítricos", "Coconut": "Coco",
        "Coconut Milk": "Leche de coco", "Coffee": "Café", "Cognac": "Coñac",
        "Coriander": "Cilantro", "Cypriol": "Cypriol", "Dark Chocolate": "Chocolate negro",
        "Dates": "Dátiles", "Elemi": "Elemí", "Fig": "Higo", "Fir Balsam": "Bálsamo de abeto",
        "Floral Notes": "Notas florales", "Freesia": "Fresia", "Fresh Notes": "Notas frescas",
        "Fruity Notes": "Notas afrutadas", "Galbanum": "Gálbano", "Gardenia": "Gardenia",
        "Geranium": "Geranio", "Ginger": "Jengibre", "Gourmand Accord": "Acorde gourmand",
        "Grapefruit": "Pomelo", "Green Mandarin": "Mandarina verde",
        "Green Tangerine": "Mandarina verde", "Guaiac Wood": "Madera de guayaco",
        "Guava": "Guayaba", "Heliotrope": "Heliotropo", "Hibiscus": "Hibisco",
        "Himalayan Nard (Jatamansi)": "Nardo del Himalaya (Jatamansi)", "Honey": "Miel",
        "Incense": "Incienso", "Indonesian Vetiver Oil": "Aceite de vetiver de Indonesia",
        "Jasmine": "Jazmín", "Kumquat": "Kumquat", "Labdanum": "Ládano",
        "Lavender": "Lavanda", "Leather": "Cuero", "Lemon": "Limón",
        "Lemongrass": "Hierba limón", "Licorice": "Regaliz",
        "Lily of the Valley": "Muguete", "Lily-of-the-Valley": "Muguete",
        "Lime": "Lima", "Litchi": "Lichi", "Mahonial": "Mahonial",
        "Mandarin": "Mandarina", "Mandarin Orange": "Mandarina", "Mango": "Mango",
        "Marigold": "Caléndula", "Marine Notes": "Notas marinas", "Marshmallow": "Malvavisco",
        "May Rose": "Rosa de mayo", "Milk": "Leche", "Mint": "Menta",
        "Molasses": "Melaza", "Moss": "Musgo", "Musk": "Almizcle", "Myrrh": "Mirra",
        "Nashi Pear": "Pera nashi", "Neroli": "Neroli", "Nutmeg": "Nuez moscada",
        "Oak moss": "Musgo de roble", "Oakmoss": "Musgo de roble",
        "Oakwood": "Madera de roble", "Olibanum": "Olíbano", "Orange": "Naranja",
        "Orange Blossom": "Azahar", "Orchid": "Orquídea", "Osmanthus": "Osmanto",
        "Oud": "Oud", "Oud Wood": "Madera de oud", "Palo Santo": "Palo santo",
        "Patchouli": "Pachulí", "Pathcouli": "Pachulí", "Pathouli": "Pachulí",
        "Peach": "Melocotón", "Pear": "Pera", "Pineapple": "Piña",
        "Pink Berry": "Bayas rosas", "Pink Pepper": "Pimienta rosa",
        "Pistachio": "Pistacho", "Plum": "Ciruela", "Powdery Notes": "Notas empolvadas",
        "Praline": "Praliné", "Raspberry": "Frambuesa", "Red Berries": "Frutos rojos",
        "Rhubarb": "Ruibarbo", "Rose": "Rosa", "Rosemary": "Romero", "Rum": "Ron",
        "Saffron": "Azafrán", "Sage": "Salvia", "Sandalwood": "Sándalo",
        "Spices": "Especias", "Strawberry": "Fresa",
        "Strawberry Fizz Candy": "Caramelo efervescente de fresa",
        "Strawberry S'mores": "Fresa con malvavisco tostado", "Suede": "Ante",
        "Sugar": "Azúcar", "Sugar Cane": "Caña de azúcar", "Sweet Orange": "Naranja dulce",
        "Taif Rose": "Rosa de Taif", "Tangerine": "Mandarina", "Tobacco": "Tabaco",
        "Tobacco Leaf": "Hoja de tabaco", "Tonka Bean": "Haba tonka",
        "Tonka Beans": "Habas tonka", "Tonkin Musk": "Almizcle Tonkin",
        "Tropical Fruits": "Frutas tropicales", "Tuberose": "Nardo",
        "Vanilla": "Vainilla", "Vanilla Syrup": "Sirope de vainilla", "Vetiver": "Vetiver",
        "Violet": "Violeta", "Violet Leaf": "Hoja de violeta", "Watermelon": "Sandía",
        "Watery Notes": "Notas acuosas", "Whipped Cream": "Nata montada",
        "White Flowers": "Flores blancas", "White Musk": "Almizcle blanco",
        "White Must": "Almizcle blanco", "Wood": "Madera", "Woodsy Notes": "Notas amaderadas",
        "Woody Notes": "Notas amaderadas", "Ylang Ylang": "Ylang-ylang"
      },
      accords: {
        "amber": "ámbar", "ambroxan": "ambroxan", "aquatic": "acuático",
        "aromatic": "aromático", "birch": "abedul", "candy": "caramelo",
        "caramel": "caramelo", "chocolate": "chocolate", "cinnamon": "canela",
        "citrus": "cítrico", "clean": "limpio", "coconut": "coco", "coffee": "café",
        "creamy": "cremoso", "dark": "oscuro", "earthy": "terroso", "fig": "higo",
        "floral": "floral", "fresh": "fresco", "fresh spicy": "especiado fresco",
        "fructured": "afrutado", "fruity": "afrutado", "ginger": "jengibre",
        "gourmand": "gourmand", "grapefruit": "pomelo", "green": "verde",
        "honey": "miel", "incense": "incienso", "lactonic": "lactónico",
        "lavender": "lavanda", "leather": "cuero", "mango": "mango",
        "marine": "marino", "metallic": "metálico", "mint": "menta",
        "mossy": "musgoso", "musk": "almizcle", "musked": "almizclado",
        "musky": "almizclado", "oriental": "oriental", "oud": "oud",
        "ozonic": "ozónico", "patchouli": "pachulí", "peach": "melocotón",
        "plum": "ciruela", "powdery": "empolvado", "resinous": "resinoso",
        "rose": "rosa", "rum": "ron", "saffron": "azafrán", "salty": "salado",
        "sandalwood": "sándalo", "smoked": "ahumado", "smoky": "ahumado",
        "spicy": "especiado", "strawberry": "fresa", "sweet": "dulce",
        "terpenic": "terpénico", "tobacco": "tabaco", "tonka": "tonka",
        "tropical": "tropical", "tuberose": "nardo", "vanilla": "vainilla",
        "warm": "cálido", "warm spicy": "especiado cálido", "watermelon": "sandía",
        "white floral": "floral blanco", "woody": "amaderado"
      },
      family: {
        "Amber": "Ámbar", "Aquatic": "Acuático", "Aromatic": "Aromático",
        "Citrus": "Cítrico", "Floral": "Floral", "Fougère": "Fougère",
        "Fresh": "Fresco", "Fruity": "Afrutado", "Gourmand": "Gourmand",
        "Green": "Verde", "Marine": "Marino", "Oriental": "Oriental",
        "Oud": "Oud", "Smoky": "Ahumado", "Spicy": "Especiado", "Sweet": "Dulce",
        "Tropical": "Tropical", "Vanilla": "Vainilla", "Woody": "Amaderado"
      }
    }
  };

  // Case-insensitive lookup index, built once per language and kind.
  var index = {};
  function lookup(kind, value, lang) {
    if (!value || lang === 'en' || !TERMS[lang]) return value;
    var k = lang + ':' + kind;
    if (!index[k]) {
      index[k] = {};
      var src = TERMS[lang][kind] || {};
      Object.keys(src).forEach(function (key) { index[k][key.toLowerCase()] = src[key]; });
    }
    var hit = index[k][String(value).trim().toLowerCase()];
    return hit || value;
  }

  window.YSP_SCENT = {
    // "Saffron" -> "Açafrão". Unknown notes pass through unchanged.
    note: function (v, lang) { return lookup('notes', v, lang); },
    // "warm spicy" -> "especiado quente"
    accord: function (v, lang) { return lookup('accords', v, lang); },
    // "Woody Oriental Oud" -> "Amadeirado Oriental Oud", word by word
    family: function (v, lang) {
      if (!v || lang === 'en' || !TERMS[lang]) return v;
      var map = TERMS[lang].family || {};
      return String(v).split(/(\s+|\/)/).map(function (tok) {
        var t = tok.trim();
        if (!t) return tok;
        var keys = Object.keys(map);
        for (var i = 0; i < keys.length; i++) {
          if (keys[i].toLowerCase() === t.toLowerCase()) return tok.replace(t, map[keys[i]]);
        }
        return tok;
      }).join('');
    },
    // "Saffron, Bergamot, Elemi" -> translated, comma separated
    noteList: function (v, lang) {
      if (!v || lang === 'en') return v;
      var self = this;
      return String(v).split(',').map(function (n) { return self.note(n.trim(), lang); }).join(', ');
    }
  };
})();
