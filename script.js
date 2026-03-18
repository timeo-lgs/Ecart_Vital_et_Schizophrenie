const url = 'mon_memoire.pdf'; 

let pdfDoc = null;
let pageNum = 1; 
let pageIsRendering = false;

// Sélecteurs
const canvasLeft = document.getElementById('left-page');
const ctxLeft = canvasLeft.getContext('2d');
const canvasRight = document.getElementById('right-page');
const ctxRight = canvasRight.getContext('2d');

// On active le cache de police pour la netteté du texte
const loadingTask = pdfjsLib.getDocument({
    url: url,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true,
});

// --- FONCTION DE RENDU ULTRA HD ---
const renderPage = (num, canvas, ctx) => {
    return pdfDoc.getPage(num).then(page => {
        
        // --- LE SECRET DE LA QUALITÉ EST ICI ---
        // On force un facteur de 4 (4 pixels calculés pour 1 pixel affiché)
        // C'est lourd, mais c'est ce qui donne le rendu "Croustillant"
        const renderQuality = 5; 

        // 1. Calcul de la place disponible sur l'écran
        const maxWidth = (window.innerWidth - 100) / 2; // -100px pour les boutons
        const maxHeight = window.innerHeight * 0.95; // 95% de la hauteur

        // 2. Calculer le scale pour que la page RENTRE (Fit to Screen)
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scaleWidth = maxWidth / unscaledViewport.width;
        const scaleHeight = maxHeight / unscaledViewport.height;
        const displayScale = Math.min(scaleWidth, scaleHeight);

        // 3. Viewport FINAL pour l'affichage écran
        const viewport = page.getViewport({ scale: displayScale });

        // 4. On configure le canvas pour être GÉANT (x4)
        canvas.width = Math.floor(viewport.width * renderQuality);
        canvas.height = Math.floor(viewport.height * renderQuality);

        // 5. Mais on l'affiche en taille NORMALE (CSS)
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        // 6. On dessine avec le multiplicateur de qualité
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
            // C'est cette ligne qui fait la magie du piqué
            transform: [renderQuality, 0, 0, renderQuality, 0, 0], 
            enableWebGL: true // Tente d'utiliser l'accélération graphique
        };
        
        return page.render(renderContext).promise;
    });
};

const renderSpread = () => {
    pageIsRendering = true;

    // Logique Couverture
    if (pageNum === 1) {
        canvasLeft.style.display = 'none';
        canvasRight.style.display = 'block';
        renderPage(1, canvasRight, ctxRight).then(() => finalizeRender());
    } 
    // Double page
    else {
        canvasLeft.style.display = 'block';
        canvasRight.style.display = 'block';

        const p1 = renderPage(pageNum, canvasLeft, ctxLeft);
        
        let p2;
        if (pageNum + 1 <= pdfDoc.numPages) {
            p2 = renderPage(pageNum + 1, canvasRight, ctxRight);
        } else {
            // Si dernière page impaire, on cache le canvas de droite
            canvasRight.style.display = 'none';
            p2 = Promise.resolve();
        }

        Promise.all([p1, p2]).then(() => finalizeRender());
    }
};

const finalizeRender = () => {
    pageIsRendering = false;
    document.getElementById('page-num').value = pageNum;
    document.getElementById('page-count').innerText = pdfDoc.numPages;
};

// --- INITIALISATION ---
loadingTask.promise.then(pdfDoc_ => {
    pdfDoc = pdfDoc_;
    renderSpread();
}).catch(err => {
    console.error(err);
    alert("Erreur : " + err.message);
});

// --- NAVIGATION ---
const goPrev = () => {
    if (pageIsRendering) return; // Empêche de cliquer comme un fou pendant le chargement
    if (pageNum <= 1) return;
    pageNum = (pageNum === 2) ? 1 : pageNum - 2;
    renderSpread();
};

const goNext = () => {
    if (pageIsRendering) return;
    if (pageNum >= pdfDoc.numPages) return;
    pageNum = (pageNum === 1) ? 2 : pageNum + 2;
    renderSpread();
};

document.getElementById('prev-btn').addEventListener('click', goPrev);
document.getElementById('next-btn').addEventListener('click', goNext);

// Clavier
document.addEventListener('keydown', (e) => {
    if (e.key === "ArrowLeft") goPrev();
    if (e.key === "ArrowRight") goNext();
});

// Input direct
document.getElementById('page-num').addEventListener('change', (e) => {
    let num = parseInt(e.target.value);
    if (num < 1) num = 1;
    if (num > pdfDoc.numPages) num = pdfDoc.numPages;
    pageNum = (num === 1) ? 1 : (num % 2 !== 0 ? num - 1 : num);
    renderSpread();
});

// Redimensionnement
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(renderSpread, 200);
});