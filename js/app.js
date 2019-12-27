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
    $("#ship").after(`<div class="laserBeem" style="left:`+(mouseX)+`px; top:`+(mouseY-80)+`px;" data-power="10"></div>`);

}


//for click elem movement 
var interVal = setInterval(function(){
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
    hold_menu = $('#ship'),
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
        $("#ship").after(`<div class="bigBeam" style="left:`+(e.pageX)+`px;" data-power="10"></div>`);
        setTimeout(function(){
            $('.bigBeam').addClass("move");
            $('#pathToBeShown').fadeOut();
        }, 300)
        createBeam =false;
        bCount = 0;
    }
   
});





// for Creating enemy
var windowWidth = $(window).width();
var windowHeight = $(window).height();
var barOfsetTop = windowHeight -20;
// var arTime = setInterval(function(){
// var randomPositon = Math.random() * windowWidth;
// var redRandom = Math.floor(Math.random() * 3); 
// $( "body" ).prepend( "<div class='enemy' style='left:"+randomPositon+"px;' data-power='30' ><img src='images/enemy/"+redRandom+".svg'></div>" );
// }, 15000);

$( "body" ).prepend( "<div class='enemy' style='left:"+500+"px;' data-power='30' ><img src='images/enemy/"+1+".svg'></div>" );



//for enemy move






//for enemy destroy
let enemyDestroy = ()=>{
    let eachEnemyOfset = 0;
    let eachEnemyWidth = 0;
    let eachEnemyHeight = 0;
    let beamdtls = {};
    $('.enemy').each(function(i){
        var toBekill = $(this);
        eachEnemyOfset = $(this).offset();
        eachEnemyWidth = $(this).width();
        // console.log(eachEnemyWidth);

        eachEnemyHeight = $(this).height();
        $('.laserBeem').each(function(){
            beamdtls={
                width: $(this).width(),
                height: $(this).height(),
                offset: $(this).offset()
            }
            console.log((eachEnemyOfset.left+50), beamdtls.offset.left);
            if(beamdtls.offset.top<eachEnemyOfset.top+eachEnemyHeight && eachEnemyOfset.left>beamdtls.offset.left && (eachEnemyOfset.left+50)<=beamdtls.offset.left  ){
                toBekill.remove();
                console.log("killed");
            }
        });
    });
}




// var pointcount = 0;
// var falseCount = 0;
// // for movement
// setInterval(function(){
//   var baGro= "";
//   $( ".balls" ).each(function(index){
//     baGro = $( ".balls" ).eq(index).css('background-color');
//     var eachTop = $(this).css('top');
//     var eachLeft = $(this).css('left');
    
//     var barPositionleft = $('.bar').css('left');
//     var ofseTop = parseInt(barOfsetTop);
//     // console.log(parseInt(eachLeft));
//     var y = parseInt(barPositionleft) + 200;
//     console.log(baGro);
//     if(ofseTop - 20 < parseInt(eachTop) && parseInt(eachLeft) > parseInt(barPositionleft) && (parseInt(eachLeft) < y) ){
//       pointcount++;
//       $('.yourSchoreis').html(pointcount);
//        $( ".balls" ).eq(index).remove();
//        console.log(pointcount);
//        $( ".bar" ).css('background-color', baGro );
//        }else if(parseInt(eachTop) >= parseInt(windowHeight)){
//          if(falseCount==3){
//            $('.outOver').fadeIn();
//            $('.outOver p').text('Your score is '+ pointcount);
//            clearInterval(arTime);
//            $( ".balls" ).remove();
//          }else{
//             falseCount++;
//          }
//          $( ".balls" ).eq(index).remove();
//         // console.log('true');
//        }else{
//         $(this).css('top',parseInt(eachTop) + 1);
//        }
     
//   });
// }, 10);