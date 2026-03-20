const url = 'Ecart_Vital_et_Schizophrenie-WebVersion-1.pdf'; 

let pdfDoc = null;
let pageNum = 1; 
let pageIsRendering = false;

const canvasLeft = document.getElementById('left-page');
const ctxLeft = canvasLeft.getContext('2d');
const canvasRight = document.getElementById('right-page');
const ctxRight = canvasRight.getContext('2d');

const loadingTask = pdfjsLib.getDocument({
    url: url,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true,
});

const isSinglePageMode = () => {
    return window.innerWidth <= 900 && window.innerHeight > window.innerWidth;
};

const renderPage = (num, canvas, ctx) => {
    return pdfDoc.getPage(num).then(page => {
        
        const isSingle = isSinglePageMode();
        const isMobile = window.innerWidth <= 900;

        const pixelRatio = window.devicePixelRatio || 1;
        const renderQuality = isSingle ? Math.min(pixelRatio * 1.5, 4) : 3; 

        const maxWidth = isSingle ? (window.innerWidth - 20) : (window.innerWidth - 100) / 2;
        
        // CORRECTION DE LA HAUTEUR : On limite le PDF à 80% de l'écran sur mobile 
        // pour laisser un bel espace aux boutons en bas et éviter le "crop" des barres Safari/Chrome.
        const heightFactor = isMobile ? 0.80 : 0.95;
        const maxHeight = window.innerHeight * heightFactor;

        const unscaledViewport = page.getViewport({ scale: 1 });
        const scaleWidth = maxWidth / unscaledViewport.width;
        const scaleHeight = maxHeight / unscaledViewport.height;
        const displayScale = Math.min(scaleWidth, scaleHeight);

        const viewport = page.getViewport({ scale: displayScale });

        canvas.width = Math.floor(viewport.width * renderQuality);
        canvas.height = Math.floor(viewport.height * renderQuality);

        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
            transform: [renderQuality, 0, 0, renderQuality, 0, 0], 
            enableWebGL: true
        };
        
        return page.render(renderContext).promise;
    });
};

const renderSpread = () => {
    pageIsRendering = true;
    const isSingle = isSinglePageMode();

    if (isSingle) {
        canvasLeft.style.display = 'none';
        canvasRight.style.display = 'block';
        renderPage(pageNum, canvasRight, ctxRight).then(() => finalizeRender());
    } else {
        if (pageNum === 1) {
            canvasLeft.style.display = 'none';
            canvasRight.style.display = 'block';
            renderPage(1, canvasRight, ctxRight).then(() => finalizeRender());
        } 
        else {
            canvasLeft.style.display = 'block';
            canvasRight.style.display = 'block';

            const p1 = renderPage(pageNum, canvasLeft, ctxLeft);
            
            let p2;
            if (pageNum + 1 <= pdfDoc.numPages) {
                p2 = renderPage(pageNum + 1, canvasRight, ctxRight);
            } else {
                canvasRight.style.display = 'none';
                p2 = Promise.resolve();
            }

            Promise.all([p1, p2]).then(() => finalizeRender());
        }
    }
};

const finalizeRender = () => {
    pageIsRendering = false;
    const inputField = document.getElementById('page-num');
    const isSingle = isSinglePageMode();
    
    if (isSingle) {
        inputField.value = `${pageNum}`;
    } else {
        if (pageNum === 1) {
            inputField.value = "1";
        } else if (pageNum + 1 <= pdfDoc.numPages) {
            inputField.value = `${pageNum}-${pageNum + 1}`;
        } else {
            inputField.value = `${pageNum}`;
        }
    }
    
    document.getElementById('page-count').innerText = pdfDoc.numPages;
};

loadingTask.promise.then(pdfDoc_ => {
    pdfDoc = pdfDoc_;
    renderSpread();
}).catch(err => {
    console.error(err);
});

const goPrev = () => {
    if (pageIsRendering || pageNum <= 1) return;
    const isSingle = isSinglePageMode();
    
    if (isSingle) {
        pageNum = pageNum - 1; 
    } else {
        pageNum = (pageNum === 2) ? 1 : pageNum - 2; 
    }
    renderSpread();
};

const goNext = () => {
    if (pageIsRendering || pageNum >= pdfDoc.numPages) return;
    const isSingle = isSinglePageMode();
    
    if (isSingle) {
        pageNum = pageNum + 1; 
    } else {
        pageNum = (pageNum === 1) ? 2 : pageNum + 2; 
    }
    renderSpread();
};

document.getElementById('prev-btn').addEventListener('click', goPrev);
document.getElementById('next-btn').addEventListener('click', goNext);

document.addEventListener('keydown', (e) => {
    if (document.activeElement.id === 'page-num') return;
    if (e.key === "ArrowLeft") goPrev();
    if (e.key === "ArrowRight") goNext();
});

document.getElementById('page-num').addEventListener('change', (e) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 1;
    if (val < 1) val = 1;
    if (val > pdfDoc.numPages) val = pdfDoc.numPages;

    const isSingle = isSinglePageMode();
    
    if (isSingle) {
        pageNum = val;
    } else {
        if (val === 1) {
            pageNum = 1;
        } else if (val % 2 !== 0) { 
            pageNum = val - 1; 
        } else {
            pageNum = val;
        }
    }
    
    e.target.blur();
    renderSpread();
});

let resizeTimeout;
let wasSinglePage = isSinglePageMode();

window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const isSingleNow = isSinglePageMode();
        if (wasSinglePage && !isSingleNow) {
            if (pageNum !== 1 && pageNum % 2 !== 0) {
                pageNum = pageNum - 1; 
            }
        }
        wasSinglePage = isSingleNow;
        renderSpread();
    }, 200); 
});