# ⟡ Éther Brave

Petit **RPG roguelike** pour téléphone, au tour par tour, dans l'esprit des RPG « gacha » à la FFBE :
chaînes de coups, jauge de **Limite**, buffs/débuffs, faiblesses élémentaires et équipements ★1 → ★5 (arc-en-ciel).

100 % HTML/CSS/JS, sans dépendance ni build : ouvre `index.html` dans un navigateur (ou publie le dossier avec GitHub Pages).
Sur mobile, « Ajouter à l'écran d'accueil » le lance en plein écran.

## Contenu
- **6 classes** (choisis-en 4) : Chevalier, Mage Noir, Mage Blanc, Voleur, Samouraï, Barde. Chacune a 4 compétences (la 4ᵉ se débloque au niveau 5) et sa propre Limite.
- **3 étages** de 8 salles : combats, élites, trésors, feux de camp, marchands, événements mystères… et un gardien au bout de chacun.
- **Combat** : touche un ennemi pour le cibler, touche un héros pour agir, **▾** pour choisir compétence/Limite/défense/objet. Enchaîne vite les héros pour faire grimper le multiplicateur de chaîne (jusqu'à ×2,5). Mode **AUTO** et bouton **Tout lancer**.
- **Buffs/débuffs** (ATT/DÉF/MAG/PSY), poison, régénération, provocation, étourdissement.
- **Équipement** : arme, armure, accessoire, avec effets passifs (élément d'arme, critique, régén auto, PM/tour, Limite accélérée…).
- **Pixel art** : 6 héros et 18 monstres (dont 3 boss en 64×64) dessinés en pixel art façon RPG 16/32-bit, générés dans `sprites.js` (formes ombrées en 4 tons + contour coloré). Champ de bataille façon FFBE : monstres à gauche, héros à droite.
- Sauvegarde automatique sur la carte (localStorage) et records.

## Fichiers
- `index.html` — page
- `style.css` — interface mobile
- `sprites.js` — pixel art des héros et monstres
- `game.js` — données et logique du jeu
