$(document).mousemove(function(e){
    $(".mousePos").text("X:"+e.pageX + " & " + "Y:"+e.pageY);
    shipMovemet(e.pageX,e.pageY);
});


// for flow mouse 
function shipMovemet(xaxis, yaxis){
    var toBeLeft =xaxis -($('#ship').width()/2);
    var toBetop =yaxis - ($('#ship').height()/2);
    $('#ship').css({"left":toBeLeft+"px", "top":toBetop+"px"});
}

//functin for fire
var fire = ()=>{
    $(document).on('click', function(e){
        var mousePosition = {
            mouseX:e.pageX,
            mouseY:e.pageY,
        };
        createLeaser(mousePosition.mouseX, mousePosition.mouseY);        
    });
}
fire();

// for Create laserbeem
var createLeaser = (mouseX, mouseY)=>{
    const audio = new Audio('audio/laser-gun-81720.mp3');
    audio.play();
    $("#ship").after(`<div class="laserBeem" style="left:`+(mouseX)+`px; top:`+(mouseY-80)+`px;" data-power="30"></div>`);

}


//for click elem movement 
var interVal = setInterval(function(){
    // const audio = new Audio('audio/plasma-gun-fire-162136.mp3');
    // audio.play();
    $('.laserBeem').each(function(i){
        var topVal = $(this).css('top');
        topVal=topVal.split("px")[0] - 50;
        if(topVal<-40){
            $(this).remove(); 
        }else{
            $(this).css('top', topVal);
        }
        
    });

    enemyDestroy();

}, 100);


//for click and hold function 
var timeout_id = 0,
    hold_time = 500,
    hold_trigger = $('#ship');
var createBeam = false;
var bCount = 0;


function menu_toggle() {
    $('#power').show();
    bCount++;
    if(bCount>6){
        $('#pathToBeShown').fadeIn();
        createBeam = true;
    }

}

hold_trigger.mousedown(function() {
    timeout_id = setInterval(menu_toggle, hold_time);

}).bind('mouseup mouseleave', function(e) {
    clearInterval(timeout_id);
    $('#power').fadeOut();
    if(createBeam === true){
        console.log("create new beam");
        const audio = new Audio('audio/plasma-gun-fire-162136.mp3');
        audio.play();
        
        $("#ship").after(`<div class="bigBeam" style="left:`+(e.pageX)+`px;" data-power="10"></div>`);
        setTimeout(function(){
            $('.bigBeam').addClass("move");
            $('#pathToBeShown').fadeOut();
        }, 300)
        createBeam =false;
        bCount = 0;
    }
   
});





// ====>>>>>for Creating enemy

var windowWidth = $(window).width();
var windowHeight = $(window).height();
var barOfsetTop = windowHeight -20;
var bossCoutn  = 0;

// for enemy creating frequency
var arTime = setInterval(function(){
    createNewEnemy();
    bossCoutn++;
    createBigboss(bossCoutn);
}, 3000);

// for enemy creating small enemy
var createNewEnemy =()=>{
    var randomPositon = Math.random() * (windowWidth - 50);
    // console.log(randomPositon);
    var redRandom = Math.floor(Math.random() * 3); 
    $( "body" ).prepend( "<div class='enemy' style='left:"+randomPositon+"px;' data-power='30' ><img src='images/enemy/"+redRandom+".svg'></div>" );
}
createNewEnemy();

var createBigboss = (bossCoutn)=>{
    if(bossCoutn%20===1){
        console.log("bigbossCreate");
        var randomPositon = Math.random() * (windowWidth - 100);
        $("body").prepend( "<div class='bigBoss enemy' style='left:"+randomPositon+"px;' data-power='200' ><img src='images/enemy/gaint.svg'></div>" );
    }
    
}
createBigboss();









//for enemy destroy
var killCount =0;
var restPower = 0;
let enemyDestroy = ()=>{
    let eachEnemyOfset = 0;
    let eachEnemyWidth = 0;
    let eachEnemyHeight = 0;
    let enemyPower = 0;
    let beamdtls = {};
    $('.enemy').each(function(i){
        var toBekill = $(this);
        eachEnemyOfset = $(this).offset();
        eachEnemyWidth = $(this).width();
        enemyPower = $(this).attr("data-power");
        // console.log(enemyPower);

        eachEnemyHeight = $(this).height();
        $('.laserBeem').each(function(){
            var toBeReomved = $(this);
            beamdtls={
                width: $(this).width(),
                height: $(this).height(),
                offset: $(this).offset(),
                power: $(this).attr("data-power")
            }
            
            // console.log("enemy right: "+ (eachEnemyOfset.left+50), "enemy beamPos: "+ beamdtls.offset.left);
            // console.log(beamdtls.offset.top<eachEnemyOfset.top+eachEnemyHeight);
            // console.log(restPower);
            // toBekill.attr('data-power', restPower);


            if(beamdtls.offset.top<eachEnemyOfset.top+(eachEnemyHeight/4) && eachEnemyOfset.left<=beamdtls.offset.left && (eachEnemyOfset.left+eachEnemyWidth)>beamdtls.offset.left){
                restPower = enemyPower - beamdtls.power;
                if(restPower<=0){
                    toBekill.find('img').addClass("hidden");
                    toBekill.removeClass("enemy").addClass("blasted").append('<img class="blastIcon in" src="images/blast/1.png">');
                       
                    setTimeout(function(){
                        $(".blasted").fadeOut(300, function(){
                            $(this).remove();
                        });
                    }, 100);
                    killCount++;
                    $('.killCoutn h2 span').html(killCount);
                }else{                    
                    toBekill.attr('data-power', restPower);
                }
                toBeReomved.remove();
                
            }

        });
    });
}



//=====>>>for enemy move

var pointcount = 0;
var falseCount = 0;
// for movement
setInterval(function(){
  $( ".enemy" ).each(function(index){
    var eachTop = $(this).css('top');
    var eachLeft = $(this).css('left');
    if(parseInt(eachTop) >= parseInt(windowHeight)){
         if(falseCount==3){
           $('.gameOver').fadeIn();
           $('.gameOver h4 span').text(killCount);           
           $(".enemy" ).remove();
           clearInterval(arTime);
         }else{
            falseCount++;
         }
         $(".enemy" ).eq(index).remove();
        console.log('true');
       }else{
        $(this).css('top',parseInt(eachTop) + 1);
       }
  });
}, 10);