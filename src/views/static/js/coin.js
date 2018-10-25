window.addEventListener("load", function() {
	$("th").click(function() {
		if($(this).html() !== 'Info') {
			$("th").removeClass("sorted descending");
			$(this).addClass("sorted descending");
			path = window.location.pathname.split("/");
			if(!(3 in path) || path[3] === '') {
				window.location = "/coin/" + coin + "/1/" + $(this).html().toLowerCase();
			} else {
				window.location = "/coin/" + coin + "/" + path[3] + "/" + $(this).html().toLowerCase();
			}
		}
	});
});