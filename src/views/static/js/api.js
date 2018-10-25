window.addEventListener("load", function() {
	$.getJSON("/api/v1/check/0xDaa29859836D97C810c7F9D350D4A1B3E8CafC9a",function(data) {
		data = JSON.stringify(data, null, 2);
		$("#check_loader").remove();
		$("#check_segment").css("overflow","scroll");
		$(".check_response").html(data);
	});
	$.getJSON("/api/v1/scams/",function(data) {
		data = JSON.stringify(data, null, 2);
		$("#scams_loader").remove();
		$("#scams_segment").css("overflow","scroll");
		$(".scams_response").html(data);
	});
	$.getJSON("/api/v1/addresses/",function(data) {
		data = JSON.stringify(data, null, 2);
		$("#addresses_loader").remove();
		$("#addresses_segment").css("overflow","scroll");
		$(".addresses_response").html(data);
	});
	$.getJSON("/api/v1/ips/",function(data) {
		data = JSON.stringify(data, null, 2);
		$("#ips_loader").remove();
		$("#ips_segment").css("overflow","scroll");
		$(".ips_response").html(data);
	});
	$.getJSON("/api/v1/verified/",function(data) {
		data = JSON.stringify(data, null, 2);
		$("#verified_loader").remove();
		$("#verified_segment").css("overflow","scroll");
		$(".verified_response").html(data);
	});
	$.getJSON("/api/v1/blacklist/",function(data) {
		data = JSON.stringify(data, null, 2);
		$("#blacklist_loader").remove();
		$("#blacklist_segment").css("overflow","scroll");
		$(".blacklist_response").html(data);
	});
	$.getJSON("/api/v1/whitelist/",function(data) {
		data = JSON.stringify(data, null, 2);
		$("#whitelist_loader").remove();
		$("#whitelist_segment").css("overflow","scroll");
		$(".whitelist_response").html(data);
	});
	$.getJSON("/api/v1/inactives/",function(data) {
		data = JSON.stringify(data, null, 2);
		$("#inactives_loader").remove();
		$("#inactives_segment").css("overflow","scroll");
		$(".inactives_response").html(data);
	});
	$.getJSON("/api/v1/actives/",function(data) {
		data = JSON.stringify(data, null, 2);
		$("#actives_loader").remove();
		$("#actives_segment").css("overflow","scroll");
		$(".actives_response").html(data);
	});
	$.getJSON("/api/v1/abusereport/changellyli.com",function(data) {
		data = JSON.stringify(data, null, 2);
		$("#abusereport_loader").remove();
		$("#abusereport_segment").css("overflow","scroll");
		$(".abusereport_response").html(data);
	});
});
