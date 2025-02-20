var acc = document.getElementsByClassName("accordion");
var i;

for (i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function() {
    this.classList.toggle("active");
    var panel = this.nextElementSibling;
    if (panel.style.maxHeight) {
      panel.style.maxHeight = null;
    } else {
      panel.style.maxHeight = panel.scrollHeight + "px";
    } 
  });
}

async function waitForDefined() {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if (gdal !== undefined ) {
                clearInterval(interval);
                resolve(gdal);
            }
        }, 1000); // Comprobamos cada 100ms
    });
}
waitForDefined().then(() => {
    console.log("La variable está definida:", gdal);
});

