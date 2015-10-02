/*************************************************************************************/
/*                                                                                   */
/*  JS Functions that, usin jqyery-sidebar, shows a list of events gotten from       */
/*  an external resource (JSON) into a sidebar and a Google Maps according to each   */
/*  of the event location with some of the event information                         */
/*                                                                                   */
/*  Author: Gorka Guerrero Ruiz - http://gorkaguerrero.es                            */
/*  Last revision: September 2015                                                    */
/*  Demo available: http://pilares15.es                                              */
/*                                                                                   */
/*  Requires: jquery                                                                 */
/*            jquery-sidebar                                                         */
/*            jquery.scrollTo                                                        */
/*            Google Maps, Twitter and Facebook API / SDK                            */
/*                                                                                   */
/*************************************************************************************/


var markers=[];
var map;
var infoWindow;
var sidebar;
var pos;
var directionsService = new google.maps.DirectionsService();
var directionsDisplay;
var iconBase = 'http://pilares15.es/assets/icons/';


function initialize() {
   
    directionsDisplay = new google.maps.DirectionsRenderer();   
   
    //Initialize map
    map = new google.maps.Map(document.getElementById("map"), {
        center: new google.maps.LatLng(41.64843, -0.89672),
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false
    });
    
    //Vars 
    var nombreMes = [ "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre" ];
    var located = false;
    var active = -1;
    var filtrosTemas;

    //For the directions
    directionsDisplay.setMap(map);

    //Infowindow for the markers
    infoWindow = new google.maps.InfoWindow({
        maxWidth: 450,
        maxHeight: 400
    });
    
    //Listener for when the infowindow closes, so the highlight of the event dissapears
    google.maps.event.addListener(infoWindow,'closeclick',function(){
       resetActive();
    });
    
    //Set the left sidebar of the map
    sidebar = $('#sidebar').sidebar();
    
    //Allow geolocation for the map, so we can calculate the route
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            //Our pos for later and also the value of this op (true if we have been located)
            pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            located = true;

        }, function() {
            handleLocationError(true, infoWindow, map.getCenter());
        });
    } else {
        // Browser doesn't support Geolocation
        handleLocationError(false, infoWindow, map.getCenter());
    }
    
    //Top scroll arrow
    $('a[href*=#]').bind("click", function(e){
		//var anchor = $(this);
		$('html, body, #sidebar, .sidebar-content, #home').scrollTo(0,800);
		e.preventDefault();
	});
    
    //Show and hide the top scroll arrow according to the sidebar scroll
	$('html, body, #sidebar, .sidebar-content, #home').scroll(function() {
		if ($(this).scrollTop() > 100) {
			$('.scroll-up').fadeIn();
		} else {
			$('.scroll-up').fadeOut();
		}
	});
    
    //Datepicker for the day
    $('#picker').datepicker({
        dateFormat: 'dd/MM/yy',
        minDate: new Date(2015,10-1,9),
        maxDate: new Date(2015,10-1,18),
        monthNames: nombreMes
    });
    
    //Check if the current day is in the festivities range, otherwise we set the day to the first day
    var currentTime = new Date();
    var pilares;
    if (currentTime.getMonth() == 9){
        if ((currentTime.getDate() <= 18) && ( currentTime.getDate() >= 9 )){
            pilares = new Date(2015,10-1, currentTime.getDate());   
        } else {
            pilares = new Date(2015,10-1,9);     
        }
        
    } else {
        pilares = new Date(2015,10-1,9);    
    }    
    //And initialize the datepicker with that value
    $('#picker').datepicker('setDate', pilares);
    
    //Load the first events into the sidebar
    $('document').ready(initSidebar());

    //Next day button to load the events that belong to the next day in the picker
    $('.next-day').on("click", function () {
        //Calculate next day
        var date = $('#picker').datepicker('getDate');
        date.setTime(date.getTime() + (1000*60*60*24));
        $('#picker').datepicker("setDate", date);
        
        //last day, we hide the button
        if (date.getDate() == 18){
            $('.next-day').css('display','none');
        }
        //Not first day, we show the prev button
        if (date.getDate() > 8){
            $('.prev-day').css('display','inline');
        }
        //Default html 
        $('#content-events').html('<span>Loading...</span>');
        //Load the events of next day into the sidebar
        getEvents(date);
    });
    
    //Prev day button to load the events that belong to the prev day in the picker
    $('.prev-day').on("click", function () {
        //Calculate prev day
        var date = $('#picker').datepicker('getDate');
        date.setTime(date.getTime() - (1000*60*60*24));
        $('#picker').datepicker("setDate", date);
        
        //Not first day, show prev button
        if (date.getDate() < 18){
            $('.next-day').css('display','inline');
        }
        //First day, hide prev button
        if (date.getDate() <= 9){
            $('.prev-day').css('display','none');
        }
        //Default html
        $('#content-events').html('<span>Loading...</span>');
        //Load the events ov prev day into the sidebar
        getEvents(date); 
    });
    
    //Initialize sidebar with the events of the default day
    function initSidebar(){
        var date = $('#picker').datepicker('getDate');
        getEvents(date);
    } 
    
    //Get all the events and show them in the sidebar
    function getEvents(date){
        
        //Clear the markers and the event that is highlighted in the sidebar
        resetMarkers();
        resetActive();
        
        //GEt day and month of the date
        var m = date.getMonth() + 1;
        var d = date.getDate(); 
        
        //Initialize the category filters
        filtrosTemas = [];
        $('#filtros').html('');
        
        //JSON url         
        var url = 'http://www.zaragoza.es/api/recurso/cultura-ocio/evento-zaragoza.json?srsname=wgs84&rows=150&sort=subEvent.horaInicio&q=programa==Fiestas%20del%20Pilar;startDate=le=2015-'+m+'-'+d+'T00:00:00Z;endDate=ge=2015-'+m+'-'+d+'T00:00:00Z';
        
        $.get(url, function(data) {
            var o = "";

            //Clear the sidebar html panel            
            $('#content-events').html('');
            
            //Looping the JSON result
            for (i=0; i<data.result.length;i++){
                //Initialize vars
                var lat = "-"; var lon = "-";
                var ini = "-"; var fin = "-";
                var d = "-"; 
                var c = "-";
                var hi = "-"; var hf = "-";
                var p = "-";
                var autobuses = "n/d"; var temas = "n/d";
                var fecha = "n/d"; var hora = "n/d"; 
                var t = "-";
                var ma = -1; 
                var id = -1;
                
                //Get this event
                var e = data.result[i];
                
                //Get title, id and other information we will need
                if (typeof e['title'] != 'undefined') {
                    t = e['title'];
                } 
                if (typeof e['id'] != 'undefined') {
                    id = e['id'];
                }             
                if (typeof e['subEvent'] != 'undefined'){
                    if (typeof e['subEvent'][0]['lugar']['direccion'] != 'undefined'){
                        d = e['subEvent'][0]['lugar']['direccion'];
                        c = e['subEvent'][0]['lugar']['cp'];
                    }
                    if (typeof e['subEvent'][0]['fechaInicio'] != 'undefined'){
                        ini = e['subEvent'][0]['fechaInicio'];
                    }
                    if (typeof e['subEvent'][0]['fechaFinal'] != 'undefined'){
                        fin = e['subEvent'][0]['fechaFinal'];
                    }
                    if (typeof e['subEvent'][0]['horaInicio'] != 'undefined'){
                        hi = e['subEvent'][0]['horaInicio'];
                    }
                    if (typeof e['subEvent'][0]['horaFinal'] != 'undefined'){
                        hf = e['subEvent'][0]['horaFinal'];
                    }
                    if (typeof e['subEvent'][0]['lugar']['autobuses'] != 'undefined'){
                        autobuses = e['subEvent'][0]['lugar']['autobuses'];
                    }
                    
                } else {

                    if (typeof e['startDate'] != 'undefined'){
                        ini = e['startDate'];
                    }
                    if (typeof e['endDate'] != 'undefined'){
                        fin = e['endDate'];
                    }
                    if (typeof e['horaInicio'] != 'undefined'){
                        hi = e['horaInicio'];
                    }
                    if (typeof e['horaFinal'] != 'undefined'){
                        hf = e['horaFinal'];
                    }
                    if (typeof e['autobuses'] != 'undefined'){
                        autobuses = e['autobuses'];
                    }
                }
                if (typeof e['geometry'] != 'undefined'){
                    lat = e['geometry']['coordinates'][0];
                    lon = e['geometry']['coordinates'][1];
                } 
                if (typeof e['temas'] != 'undefined'){
                    temas = e['temas'][0]['title'];
                }
                if (typeof e['price'] != 'undefined'){
                    p = e['price'][0]['hasCurrencyValue']+' euros';
                } else if (typeof e['tipoEntrada'] != 'undefined') {
                    p = 'libre';
                } else if (typeof e['precioEntrada'] != 'undefined'){
                    p = e['precioEntrada'];
                    p = p.replace(/<\/?div[^>]*>/g,"").replace(/(?:\\[rn][ ])+/g, ". ");
                }
                
                //Convert time and date to string    
                fecha = getDateString(ini, fin, hi, hf);
                hora = getTimeString(hi, hf);
                //Add the event tag to the filter array (filtered)
                addFilter(temas.replace(/[, \/]+/g, ""));
                
                //If we have coordinates, add also the marker to the map
                if (lat != '-'){                    
                    ma = addMarker(t, fecha, lat, lon, d, c, fecha, hora, p, autobuses, temas, id); 
                }
                
                //Facebook button                              
                var facebook = '<div class="fb-share-button" data-href="http://www.zaragoza.es/ciudad/cultura/agenda/fichacultura_Agenda?id='+id+'" data-send="true" data-layout="button" data-width="66" data-show-faces="false">Facebook</div>';
                
                //HTML for the sidebar
                var text = '<div class="title"><img src="'+getIcon(temas.replace(/[, \/]+/g, ""))+'" alt="icono '+temas+'" height="30" width="26" />&nbsp;<h3 class="marker_title">'+t+'</h3></div>'+
                '<span class="marker_address"><i class="fa fa-home"></i>&nbsp;'+d+' ('+c+') </span>'+
                '<span class="marker_date"><span class="marker_day"><i class="fa fa-calendar"></i>&nbsp;'+fecha+'</span><span class="marker_time"><i class="fa fa-clock-o"></i>&nbsp;'+hora+'</span></span>'+
                '<span class="marker_price"><i class="fa fa-eur"></i>&nbsp;&nbsp;'+p+'</span>'+
                '<span class="marker_bus"><i class="fa fa-bus"></i>&nbsp&nbsp;'+autobuses+'</span>'+
                '<span class="marker_tags"><i class="fa fa-tags"></i>&nbsp;&nbsp;'+temas+'</span><br><br>'+
                '<span class="marker_desc"><a href="http://www.zaragoza.es/ciudad/cultura/agenda/fichacultura_Agenda?id='+id+'" target="_blank">Descripción y más detalles</a>&nbsp;&nbsp;<i class="fa fa-external-link"></i></span><br><br>';
                //Social media buttons in the html
                //Also link to show the marker in the map if we have coordinates
                text += '<span class="marker_line"><span class="marker_a"><span id="tw'+i+'"></span></span><span class="marker_a">'+facebook+'</span>'+
                ((ma != -1)?'<span class="marker_a"><a href="javascript:myclick('+(ma)+');">Ver <i class="fa fa-map-marker"></i> en mapa</a></span>':'')+
                '</span>';
                
                //Add to the html and give some attribures depending if the event has marker or not
                if (ma != -1){
                    o = $(document.createElement('div')).attr('id','event_'+ma).addClass('marker_list '+temas.replace(/[, \/]+/g, "")).html(text);    
                } else {
                    o = $(document.createElement('div')).addClass('marker_list '+temas.replace(/[, \/]+/g, "")).html(text);
                }
                //Append to the panel
                $('#content-events').append(o); 
                
                //Reload and get the twitter button
                twttr.widgets.createShareButton(
                    'http://www.zaragoza.es/ciudad/cultura/agenda/fichacultura_Agenda?id='+id,
                    document.getElementById('tw'+i+''),
                    {
                        text: '¡Voy a asistir a un evento de las Fiestas del Pilar!',
                        hashtags: 'Pilares15',
                        url: 'http://www.zaragoza.es/ciudad/cultura/agenda/fichacultura_Agenda?id='+id,
                        count: 'none'
                    }
                );
   
            } //end of loop
            //Reload all the Facebook buttons
            try {FB.XFBML.parse();} catch (error) {$('.fb-share-button').remove(); }
            
            //Add arrow for scrolling to top
            $('#content-events').append($(document.createElement('div')).addClass('scroll-up').html('<a href="#top"><i class="fa fa-angle-up"></i></a>'));
            
            //Add filters to the panel
            var filtrosText = '';
            for (i=0;i<filtrosTemas.length;i++){
                //for each filter, add it to the sidebar with an id and a link and icon
                $('#filtros').append($(document.createElement('li')).attr('id','icono_'+filtrosTemas[i]).html('<a href="javascript:hideFilter(\''+filtrosTemas[i]+'\');" role="tab" title="'+filtrosTemas[i]+'"><img src="'+getIcon(filtrosTemas[i])+'" alt="icono '+filtrosTemas[i]+'" height="30" width="26" /></a>'));
            }
            
        }, "json");    
    }
 
    //Function that gets two dates and returns a formatted string with them   
    function getDateString(ini, fin){
        var f = "";
        var di = new Date(ini);
        var df = new Date(fin);
        
        if (ini == fin){
            f = di.getDate()+' de '+nombreMes[di.getMonth()];    
        } else {
            if (di.getMonth() == df.getMonth()){
                f = di.getDate()+' al '+(df.getDate())+' de '+nombreMes[di.getMonth()];    
            } else {
                f = di.getDate()+' de '+nombreMes[di.getMonth()]+' al '+(df.getDate())+' de '+nombreMes[df.getMonth()];    
            } 
        }
        return f;
    }
    
    //Function that gets two times and returns a formatted string with them 
    function getTimeString(hi, hf){
        var f = "-";

        if (hi != '-'){
            if (hf != '-'){
                f = hi+' a '+hf+' horas';
            } else {
                f = hi+' horas';     
            } 
        }
        return f;
    }
    
    //Function returns the icon of a tag 
    function getIcon(tema){
        
        switch(tema){
            case 'Exposicionesymuseos':
                return iconBase + 'temple.png';
            case 'Música': 
                return iconBase + 'music_rock.png';
            case 'Fiestas': 
                return iconBase + 'fireworks.png'
            case 'Teatro': 
                return iconBase + 'theater.png'
            case 'Otros': 
                return iconBase + 'festival.png'
            case 'Bibliotecas': 
                return iconBase + 'book.png'
            case 'FeriasMuestrasySalones': 
                return iconBase + 'mall.png'
            case 'Deportes': 
                return iconBase + 'soccer.png'
            case 'ActosReligiosos': 
                return iconBase + 'chapel.png'
            case 'Gastronomía': 
                return iconBase + 'restaurant.png'
            case 'CursosyTalleres': 
                return iconBase + 'workoffice.png'
            case 'DanzasBailes': 
                return iconBase + 'dance_class.png'   
            default:
                return iconBase + 'sight-2.png'    
        }       
    }
    
    //Function that adds a new tag into the array if it is not in the array
    function addFilter(temas){
        
        if (filtrosTemas.indexOf(temas) == -1){
            filtrosTemas.push(temas);    
        }
    }
    
    //Function that reset all the markers we have
    function resetMarkers(){
        setMapOnAll(null);
        markers = [];
    }
    
    //Function that reset teh highlighted marker in the sidebar
    function resetActive(){
        $('#event_'+active).css('border-right','');
        active = -1;
    }
    
    // Sets the map on all markers in the array.
    function setMapOnAll(map) {
        for (var i = 0; i < markers.length; i++) {
            markers[i].setMap(map);
        }
    }

    //Function that adds a marker with an event to the map 
    function addMarker(t, fecha, lat, lon, d, c, fecha, hora, p, autobuses, temas, id){
        //Filtered tag of the event
        var temasClean = temas.replace(/[, \/]+/g, "");
        
        //New marker with some options and viisble by default
        var marker = new google.maps.Marker({
            position: new google.maps.LatLng(lon.toFixed(6),lat.toFixed(6)),
            map: map,
            visible: true,
            topic: temasClean,
            title: t,
            icon: getIcon(temasClean),
            //ID of the marker
            iev: markers.length
        });
        
        //HTML to show inside the marker
        var header = '<h3>'+t+'</h3>';
        var texto = '<br><span class="marker_address"><i class="fa fa-home"></i>&nbsp;'+d+' ('+c+') </span>'+
        '<span class="marker_date"><span class="marker_day"><i class="fa fa-calendar"></i>&nbsp;'+fecha+'</span><span class="marker_time"><i class="fa fa-clock-o"></i>&nbsp;'+hora+'</span></span>'+
        '<span class="marker_price"><i class="fa fa-eur"></i>&nbsp;&nbsp;'+p+'</span>'+
        '<span class="marker_bus"><i class="fa fa-bus"></i>&nbsp&nbsp;'+autobuses+'</span>'+
        '<span class="marker_tags"><i class="fa fa-tags"></i>&nbsp;&nbsp;'+temas+'</span><br><br>'+
        '<span class="marker_desc"><a href="http://www.zaragoza.es/ciudad/cultura/agenda/fichacultura_Agenda?id='+id+'" target="_blank">Descripción y más detalles</a>&nbsp;&nbsp;<i class="fa fa-external-link"></i></span><br><br>';
        //HTML with the from our position to the event location
        var routes = '<span class="ruta">Calcular ruta: <a href="javascript:calculateAndDisplayRouteCar('+lon+','+lat+');">Coche</a>&nbsp;&nbsp;<a href="javascript:calculateAndDisplayRouteWalk('+lon+','+lat+');">Andando</a>&nbsp;&nbsp;<a href="javascript:calculateAndDisplayRoutePublic('+lon+','+lat+');">Transporte Público</a></span><br><br><span class="gDistance"></span>';
        
        // Prepare the content to show in the infowindow 
        var content = '<div id="infoWin">'+
        header+'<hr>'+
        texto+'<hr>'+
        routes+
        '</div>'+
        '<br />';
        
        //Add a listener to this marker
        google.maps.event.addListener(marker, 'click', function(salto) {
            //we want to now if we will do auto scroll inside the sidebar panel
            salto = (typeof salto[0] !== 'undefined' ? salto[0] : !sidebar.isOpen());
                        
            //Set the content and move the map to avoid the sidebar collapse
            infoWindow.setContent(content);
            infoWindow.open(map, marker);
            map.setCenter(marker.position);
            map.panBy(-100,-20);
            
            //Remove highlight class in previous event
            if (active != -1){
                $('#event_'+active).css('border-right','');
            }
            //Scroll to the event position in the sidebar           
            if (salto) {
                $('html, body, #sidebar, .sidebar-content, #home').scrollTo($('#event_'+marker.iev),800, {offset: -10});
            }
            //Get the new highlighted event (infowindow open) and highlight it in the sidebar
            active = marker.iev;
            $('#event_'+active).css('border-right','3px solid #E81B16');

            //If we have authorised before teh geolocation, show the links to calculate the routes or hide then and show a message instead
            if (located){
                directionsDisplay.setDirections({routes: []});
                $('.ruta').css('display','inline');
            } else {
                $('.ruta').html('No hemos podido determinar su posición para mostrar el cálculo de rutas.');
                $('.ruta').css('display','inline');
            }   
        });
        //add the marker to the array and return the lenght of the same (that is the id of the last marker we have added)
        markers.push(marker);
        return (markers.length-1);
    } 
       
} //End of inilialize function


//Function that hides or shows the events in the sidebar and their markers in the map depending on the user selection
function hideFilter(tema){
    
    //Not hidden 
    if (!$('.'+tema+'').hasClass('oculto')) {
        //WE hide all the events that matches our selection
        for (i = 0; i < markers.length; i++) {
            if (markers[i].topic == tema){
                markers[i].setVisible(false);    
            }
        }
        //Add some classes to hide the html and change the filter icon
        $('#icono_'+tema+' > a > img').addClass('sombra');
        $('.'+tema+'').addClass('oculto');
    //Is hidden
    } else {
        //Show again the hidden markers
        for (i = 0; i < markers.length; i++) {
            if (markers[i].topic == tema){
                markers[i].setVisible(true);    
            }
        }
        //Shwo the html and give teh original aspect to the icon filter
        $('#icono_'+tema+' > a > img').removeClass('sombra');
        $('.'+tema+'').removeClass('oculto');
    }
    
}

//Function that opens the infowindow of a marker that we have chosen from the sidebar
function myclick(i) {
    //Trigger action, we imitate a click over the marker
    google.maps.event.trigger(markers[i], "click", [false]);
    var isMob = false;
    //Ckec if the screen resolution shows sidebar and map at the same time or not
    if(window.innerWidth <= 800 && window.innerHeight <= 600) {
        isMob = true;
    }
    //Move center of the marker to avoid collapsing with the sidebar 
    map.panTo(markers[i].position);
    map.panBy(-100,-20);
    //Clear previous routes we have shown
    directionsDisplay.setDirections({routes: []});
    //Is mobile phone, we close the sidebar to show the map
    if (isMob){
        sidebar.close();      
    }
}

//Shwo message if we cannot geolocate the device
function handleLocationError(browserHasGeolocation, infoWindow, pos) {
    infoWindow.setPosition(pos);
    infoWindow.setContent(browserHasGeolocation ?
        'Error: The Geolocation service failed.' :
        'Error: Your browser doesn\'t support geolocation.'
    );
}

//Function to calculate the route by car from our position to the event
function calculateAndDisplayRouteCar(lon, lat) {    
    var to = new google.maps.LatLng(lon.toFixed(6),lat.toFixed(6));
    calculateAndDisplayRoute(to, google.maps.TravelMode.DRIVING); 
}

//Function to calculate the route by walking from our position to the event
function calculateAndDisplayRouteWalk(lon, lat) {    
    var to = new google.maps.LatLng(lon.toFixed(6),lat.toFixed(6));
    calculateAndDisplayRoute(to, google.maps.TravelMode.WALKING); 
}

//Function to calculate the route by public transport from our position to the event
function calculateAndDisplayRoutePublic(lon, lat) {
    var to = new google.maps.LatLng(lon.toFixed(6),lat.toFixed(6));
    calculateAndDisplayRoute(to, google.maps.TravelMode.TRANSIT); 
}

//Function that calculates and show the route
function calculateAndDisplayRoute(to, mode) {
  
    //From and to positions, and selected mode
    directionsService.route({
        origin: pos,
        destination: to,
        travelMode: mode
    }, 
    function(response, status) {
        if (status === google.maps.DirectionsStatus.OK) {
            //Get response and show into the map and show too some info inside the infowindow
            directionsDisplay.setDirections(response);
            showDistance(response);
        } else {
            window.alert('Directions request failed due to ' + status);
        }
    });
}

//Function that shows inside the infowindow the distance and time from our position to destination
function showDistance(directionResult) {
    //Replace html
    var myRoute = directionResult.routes[0].legs[0];
    $('.gDistance').html('Distancia total: '+myRoute.distance.text+'. <br>Tiempo aprox.: '+myRoute.duration.text+'.');
}



