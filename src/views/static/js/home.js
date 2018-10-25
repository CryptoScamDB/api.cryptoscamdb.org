window.addEventListener("load", function() {
	$("#github").click(function() {
		window.open('https://github.com/CryptoScamDB/cryptoscamdb.org');
	});
	$("#scams").click(function() {
		window.open('/scams');
	});
	$("#report").click(function() {
		window.open('/report');
	});
	$("#donate").click(function() {
		window.open('https://etherscan.io/address/cryptoscamdb.eth');
	});
});