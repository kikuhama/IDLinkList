/*
  InDesignデータにリンクされているファイル情報を
  タブ区切りテキスト / XMLで書き出す
  Version 1.0.0
  ©Copyright Hamajima Shoten, Publishers & Kikuchi Ken 2015

  Changes
  Version 1.0.0
  - 初期バージョン
  Version 1.1.0 (2015/11/20)
  - ファイルオープン時などにエラーが発生した場合，中断せず，最後にエラーログを書き出すよう変更。
*/
#target indesign

app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;

function dumpObj(obj) {
    $.writeln("----");
    $.writeln(obj.toString());
    for(var prop in obj) {
	try {
	    $.writeln("name: " + prop + "; value: " + obj[prop]);
	}
	catch(e) {
	    $.writeln("name: " + prop + "; cannot access this property.");
	}
    }
}

var OptionDialog = function() {
    var EDIT_HEIGHT = 20;
    var RADIO_HEIGHT = 20;
    var STATIC_OFFSET = 5;
    var STATIC_HEIGHT = 15;
    var BUTTON_HEIGHT = 20;
    var LINE_HEIGHT = 25;
    var y;
    var window = new Window("dialog", "書き出し設定");
    var option = {
	target: null,
	targetFolder: null,
	exportType: "text"
    };

    var checkCondition = function() {
	switch(option.target) {
	case "activeDocument":
	    window.footer.okButton.enabled = true;
	    break;
	case "folder":
	    window.footer.okButton.enabled = (option.targetFolder != null);
	    break;
	}
    };

    var onSelectExportType = function() {
	if(this == window.exportGroup.textRadio) {
	    option.exportType = "text";
	}
	else if(this == window.exportGroup.xmlRadio) {
	    option.exportType = "xml";
	}
    };
    
    var onSelectTarget = function() {
	if(this == window.targetGroup.activeDocRadio) {
	    // アクティブドキュメント
	    window.targetGroup.pathEdit.enabled = false;
	    window.targetGroup.selectFolderButton.enabled = false;
	    option.target = "activeDocument";
	}
	else if(this == window.targetGroup.filesInFolderRadio) {
	    // フォルダ内のファイル
	    window.targetGroup.pathEdit.enabled = true;
	    window.targetGroup.selectFolderButton.enabled = true;
	    option.target = "folder";
	}
	checkCondition();
    };

    var selectFolder = function() {
	var folder = Folder.selectDialog("処理対象フォルダの選択");
	if(folder) {
	    // フォルダが選択された
	    option.targetFolder = folder;
	    window.targetGroup.pathEdit.text = folder.fsName;
	}
	checkCondition();
    };

    var onPathChanging = function() {
	var path = this.text;
	var folder = new Folder(path);
	if(folder.exists) {
	    option.targetFolder = folder;
	}
	else {
	    option.targetFolder = null;
	}
	checkCondition();
    };

    var _this = this;
    window.targetGroup = window.add("panel",
				    [10, 10, 400, 90],
				    "処理対象");
    y = 10;
    window.targetGroup.activeDocRadio
	= window.targetGroup.add("radiobutton",
				 [15, y, 155, y + RADIO_HEIGHT],
				 "現在のドキュメント");
    window.targetGroup.activeDocRadio.onClick = onSelectTarget;
    window.targetGroup.filesInFolderRadio
	= window.targetGroup.add("radiobutton",
				 [160, y, 300, y + RADIO_HEIGHT],
				 "フォルダ内のファイル");
    window.targetGroup.filesInFolderRadio.onClick = onSelectTarget;
    y += LINE_HEIGHT;
    window.targetGroup.add("statictext",
			   [15, y + STATIC_OFFSET,
			    50, y + STATIC_OFFSET + STATIC_HEIGHT],
			   "フォルダ");
    window.targetGroup.pathEdit
	= window.targetGroup.add("edittext",
				 [55, y, 300, y + EDIT_HEIGHT]);
    window.targetGroup.pathEdit.onChanging = onPathChanging;
    window.targetGroup.selectFolderButton
	= window.targetGroup.add("button",
				 [305, y, 380, y + BUTTON_HEIGHT],
				 "参照");
    window.targetGroup.selectFolderButton.onClick = selectFolder;
    if(app.documents.length == 0) {
	window.targetGroup.activeDocRadio.enabled = false;
	window.targetGroup.filesInFolderRadio.value = true;
	option.target = "folder";
    }
    else {
	window.targetGroup.activeDocRadio.value = true;
	window.targetGroup.pathEdit.enabled = false;
	window.targetGroup.selectFolderButton.enabled = false;
	option.target = "activeDocument";
    }

    window.exportGroup = window.add("panel",
				    [10, 100, 400, 140],
				    "出力形式");
    y = 10;
    window.exportGroup.textRadio
	= window.exportGroup.add("radiobutton",
				 [15, y, 155, y + RADIO_HEIGHT],
				 "テキスト形式");
    window.exportGroup.textRadio.value = true;
    window.exportGroup.textRadio.onClick = onSelectExportType;
    window.exportGroup.xmlRadio
	= window.exportGroup.add("radiobutton",
				 [160, y, 300, y + RADIO_HEIGHT],
				 "XML形式");
    window.exportGroup.xmlRadio.onClick = onSelectExportType;
    
    window.footer = window.add("panel", [10, 150, 400, 190]);
    y = 10;
    window.footer.cancelButton
	= window.footer.add("button",
			    [200, y, 280, y + BUTTON_HEIGHT],
			    "キャンセル");
    window.footer.cancelButton.onClick = function() {
	window.close();
    };
    window.footer.okButton
	= window.footer.add("button",
			    [290, y, 380, y + BUTTON_HEIGHT],
			    "OK");
    window.footer.okButton.onClick = function() {
	_this.ok = true;
	window.close();
    };
    checkCondition();
    
    this.window = window;
    this.option = option;
};

OptionDialog.prototype.show = function(handler) {
    this.ok = false;
    this.window.show();
    if(this.ok && handler) {
	handler();
    }
};

var LinkAnalyzer = function() {
    this.links = [];
    this.errors = [];
};

LinkAnalyzer.prototype.findFileInFolder = function(folder) {
    var files = folder.getFiles("*");
    for(var i=0; i<files.length; ++i) {
	try {
	    var f = files[i];
	    if(f instanceof Folder) {
		this.findFileInFolder(f);
	    }
	    else if(f.name.match(/\.indd$/)){
		var doc = app.open(f);
		this.analyzeDoc(doc);
		doc.close(SaveOptions.NO);
	    }
	}
	catch(e) {
	    this.errors.push(e);
	}
    }
};

LinkAnalyzer.prototype.analyzeDoc = function(doc){
    this.currentDocName = doc.name;
    for(var pageIndex = 0; pageIndex < doc.pages.length; ++pageIndex) {
	this.analyzePage(doc.pages[pageIndex]);
    }
    this.currentDocName = "";
};

LinkAnalyzer.prototype.analyzePage = function(page) {
    var graphicsCount = page.allGraphics.length;
    for(var graphicIndex=0; graphicIndex < graphicsCount; ++graphicIndex) {
	var g = page.allGraphics[graphicIndex];
	if(g && g.itemLink) {
	    var record = {
		docName: this.currentDocName,
		page: page.name,
		link: g.itemLink.name
	    };
	    this.links.push(record);
	}
    }
}

LinkAnalyzer.prototype.run = function(option) {
    this.links = [];
    switch(option.target) {
    case "activeDocument":
	this.analyzeDoc(app.activeDocument);
	break;
    case "folder":
	this.findFileInFolder(option.targetFolder);
	break;
    }
    var saveFile = this.getSaveFile(option.exportType);
    if(saveFile && saveFile.open("w")) {
	saveFile.encoding = "utf-8";
	if(option.exportType == "xml") {
	    // XML
	    saveFile.write(this.toXML());
	}
	else {
	    // TEXT
	    saveFile.write(this.toText());
	}
	saveFile.close();
    }

    if(this.errors.length > 0) {
	alert("いくつかのエラーが発生しました。エラー内容を保存するファイル名を指定してください。");
	var errorLogFile = this.getErrLogFile();
	if(errorLogFile && errorLogFile.open("w")) {
	    for(var i=0; i<this.errors.length; ++i) {
		errorLogFile.writeln(this.errors[i].description);
	    }
	    errorLogFile.close();
	}
    }
}

LinkAnalyzer.prototype.toXML = function() {
    var xmldoc = new XML("<documents/>");
    var currentDocName = null;
    var currentPage = null;
    var documentEle = null;
    var pageEle = null;
    var linkEle = null;
    for(var i=0; i<this.links.length; ++i) {
	var record = this.links[i];
	if(record.docName != currentDocName) {
	    currentDocName = record.docName;
	    documentEle = new XML("<document/>");
	    documentEle.@name = record.docName;
	    xmldoc.appendChild(documentEle);
	    currentPage = null;
	}
	if(documentEle && record.page != currentPage) {
	    currentPage = record.page;
	    pageEle = new XML("<page/>");
	    pageEle.@name = record.page;
	    documentEle.appendChild(pageEle);
	}
	if(pageEle) {
	    linkEle = new XML("<link/>");
	    linkEle.@name = record.link;
	    pageEle.appendChild(linkEle);
	}
    }

    return "<?xml version='1.0' encoding='utf-8'?>" + xmldoc.toXMLString();
}

LinkAnalyzer.prototype.toText = function() {
    var text = "ドキュメント\tページ\tリンクファイル名\n";
    for(var i=0; i<this.links.length; ++i) {
	var record = this.links[i];
	text += record.docName + "\t" + record.page + "\t"
	    + record.link + "\n";
    }
    return text;
}

LinkAnalyzer.prototype.getErrLogFile = function() {
    var filter = "*.txt";
    var file = new File("linklist.txt");
    file = file.saveDlg("エラーログファイル名を指定してください。",
			filter,
			false);
    return file;
}

LinkAnalyzer.prototype.getSaveFile = function(exportType) {
    var filter = "*.txt";
    var file = new File("linklist.txt");
    if(exportType == "xml") {
	filter = "*.xml";
	file = new File("linklist.xml");
    }
    file = file.saveDlg("エクスポートファイル名を指定してください。",
			filter,
			false);
    return file;
}

var optDialog = new OptionDialog();
optDialog.show(function() {
    var analyzer = new LinkAnalyzer();
    analyzer.run(optDialog.option);
});
