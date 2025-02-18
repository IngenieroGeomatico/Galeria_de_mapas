var fileUpload = document.querySelector(".upload");

var filesObj={}

var n = 1

function readUrl(input) {
  
  if (input.files && input.files[0]) {
    let reader = new FileReader();
    reader.onload = (e) => {
      let imgData = e.target.result;
      let imgName = input.files[0].name;
      input.setAttribute("data-title", imgName);
      console.log(e.target.result);
      setTimeout(() => fileUpload.classList.add("done"), 3000);
      setTimeout(() => fileUpload.classList.remove("done"), 6000);
      setTimeout(() => fileUpload.classList.remove("drop"), 6000);
      reader.name = imgName
      console.log(reader)
      filesObj[n] = reader
      n +=1
    }
    reader.readAsDataURL(input.files[0]);
  }

}


fileUpload.addEventListener("dragover", function() {
  this.classList.add("drag");
  this.classList.remove("drop", "done");
});

fileUpload.addEventListener("dragleave", function() {
  this.classList.remove("drag");
});

fileUpload.addEventListener("drop", start, false);
fileUpload.addEventListener("change", start, false);

function start() { 
  this.classList.remove("drag");
  this.classList.add("drop");
  
}

