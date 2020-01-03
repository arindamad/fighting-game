 // Your web app's Firebase configuration
 var firebaseConfig = {
    apiKey: "AIzaSyCzjKe7J0REFL-eku83LPmyrevYpUfDA7Y",
    authDomain: "fighter-db-89873.firebaseapp.com",
    databaseURL: "https://fighter-db-89873.firebaseio.com",
    projectId: "fighter-db-89873",
    storageBucket: "fighter-db-89873.appspot.com",
    messagingSenderId: "806782425742",
    appId: "1:806782425742:web:e034d66f8900e46d3307df",
    measurementId: "G-YM9LFCMR5J"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);


// Reference messages collection
var messagesRef = firebase.database().ref('messages');

// Listen for form submit
document.getElementById('saveNameGroup').addEventListener('submit', submitForm);

// Submit form
function submitForm(e){
e.preventDefault();
var name = getInputVal('playerName');
var score = killCount;  
saveMessage(name, score);
}
var fireLocation = "";

// Function to get get form values
function getInputVal(id){
    return document.getElementById(id).value;
}


var getDataFormDatabse= ()=>{    
    var leadsRef = firebase.database().ref('messages');
    leadsRef.on('value', function(snapshot) {
        snapshot.forEach(function(childSnapshot) {
        var childData = childSnapshot.val();
        console.log(childData);
        makeTable(childData);
        $('.scoreBoard').fadeIn();
        });    
    });
}





// Save message to firebase
function saveMessage(name, score){
var newMessageRef = messagesRef.push();
// var newID = newMessageRef.name("arindamad");
fireLocation = newMessageRef.key;
newMessageRef.key = "arindamad"
// console.log(newMessageRef.key);

newMessageRef.set({
    name: name,
    score:score
}, function(error){
    if (error) {
    // The write failed...
    alert("Please try again");
    } else {
    // alert("success");
    $("#saveNameGroup").fadeOut();
    getDataFormDatabse();
    // $(".gameOver h1").html("Welcome "+name).fadeIn();
    


    }
});

}



// Check form Will 
if (typeof(Storage) !== "undefined") {
    // Store
    localStorage.setItem("fireLocation", "Smith");
    
    // Retrieve
    // document.getElementById("result").innerHTML = localStorage.getItem("lastname");
  } else {
    // document.getElementById("result").innerHTML = "Sorry, your browser does not support Web Storage...";
  }


var makeTable = (obj)=>{
    $('#scoreTable tbody').append('<tr><td>'+obj.name+'</td><td>'+obj.score+'</td></tr>')
}