//'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
// The module 'azdata' contains the Azure Data Studio extensibility API
// This is a complementary set of APIs that add SQL / Data-specific functionality to the app
// Import the module and reference it with the alias azdata in your code below
import * as azdata from 'azdata';
export function activate(context: vscode.ExtensionContext) {
	function convertSql() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            var inputText = document.getText();
            const myMap = new Map();
            console.log("---------");
            inputText = inputText.replace('\r\n', '\n');
            const lines = inputText.split('\n'); //'\n');const separator = path.sep;
            const argList = [];
            const processedLines = [];
            let insideProcedure = false;
            var isSuccess = 0;
            var i = 1;
            for (var line of lines) { //lines.forEach(line => {
                if (i === 1) {
                    if (line.indexOf("CONVERT_SUCCESS") >= 0) {
                        vscode.window.showErrorMessage('Failure!The stored procedure has been processed and does not require repeated processing,If you still want to proceed, please try removing the CONVERT from the first CONVERT_SUCCESS keyword');
                        return;
                    }
                    else {
                        line = `${line}--CONVERT_SUCCESS,Date:${new Date().toISOString()}`;
                        console.info("line:" + i + ",[SetConvertedFlag]->" + line);
                    }
                }
                if (line.toLocaleLowerCase().indexOf("drop proc") >= 0) {
                    processedLines.push("--" + line);
                }
                else if (line.match(/^\s*(ALTER|CREATE)\s+PROCEDURE|^\s*(ALTER|CREATE)\s+proc/i)) { // 忽略大小写，允许前面的空格 // 匹配 ALTER procedure 或 ALTER PROCEDURE          if (line.match(/^ALTER\s+procedure/i)) { // 匹配 ALTER procedure 或 ALTER PROCEDURE
                    insideProcedure = true;
                    processedLines.push(`-- ${line}`);
                    console.info("line:" + i + "," + "[存储过程名开始]->" + line);
                    isSuccess++;
                }
                else if (insideProcedure && line.match(/^\s*AS/i)) {
                    insideProcedure = false;
                    console.info("line:" + i + "," + "[存储过程名结束]->" + line);
                    processedLines.push(`-- ${line}`);
                    isSuccess++;
                }
                else if (insideProcedure) {
                    var commentI = line.indexOf("--");
                    var varStartI = line.indexOf("@");
                    if (commentI >= 0 && varStartI > commentI) {
                        processedLines.push(line);
                        console.info("line:" + i + ",[存储过程参数已注释忽略]->" + line);
                    }
                    else if (varStartI >= 0) { //必须没有注释掉
                        var varEndI = line.indexOf(" ", varStartI + 1);
                        const varName = line.slice(varStartI, varEndI);
                        var alteredLine = 'declare ' + line.replace(',', ";");
                        var outputIndex = line.toLocaleLowerCase().indexOf("output");
                        if (outputIndex > 0) {
                            var outputName = line.substring(outputIndex, outputIndex + "output".length);
                            alteredLine = alteredLine.replace(outputName, '--' + outputName);
                        }
                        else {
                            outputIndex = line.toLocaleLowerCase().indexOf("out");
                            if (outputIndex > 0) {
                                var outputName = line.substring(outputIndex, outputIndex + "out".length);
                                alteredLine = alteredLine.replace(outputName, '--' + outputName);
                            }
                        }
                        argList.push(varName);
                        processedLines.push(alteredLine);
                        console.info("line:" + i + ",[存储过程参数" + varName + "]->" + alteredLine);
                        isSuccess++;
                    }
                    else {
                        console.info("line:" + i + ",[存储过程参数杂项忽略]->" + line);
                        isSuccess++;
                        processedLines.push("--X" + line);
                    }
                }
                else if (line.match(/^\s*RETURN/i)) {
                    isSuccess++;
                    const returnI = line.toLocaleLowerCase().indexOf("return");
                    var startBlank = returnI === 0 ? "" : line.slice(0, returnI); //方便保持缩进
                    console.info("line:" + i + ",[返回语句处理]->" + line);
                    //as N'@ReturnCode',
                    processedLines.push(`${startBlank}select ${i} as N'responseLine',${argList.length} as N'argCount',` + argList.map(item => `${item} as N'${item}'`).join(',') + `;return;--${line}`);
                    // processedLines.push(`${startBlank}select 'returnLineNumber'='${i}','argCount'='${argList.length}',` + argList.join(',') + `;return;--${line}`);
                    // processedLines.push(`${startBlank}select 'returnLineNumber'='${i}','argCount'='${argList.length}',` + argList.join(',') + `;return;--${line.slice(returnI)}`);
                }
                else {
                    processedLines.push(line);
                }
                i++;
            }
            const processedSQL = processedLines.join('\n');
            const convertedText = processedSQL; //inputText.replace(/old_text/g, 'new_text');
            if (isSuccess > 0) {
                vscode.window.showInformationMessage(`Success!Processed ${isSuccess} line of code in total`);
            }
            else {
                vscode.window.showErrorMessage('Failure!Not Found Stored Procedure Syntax Error');
                return;
            }
            editor.edit(editBuilder => {
                const start = new vscode.Position(0, 0);
                const end = new vscode.Position(document.lineCount, 0);
                const range = new vscode.Range(start, end);
                editBuilder.replace(range, convertedText);
            });
        }
    }
    function convertSqlReverse() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            var inputText = document.getText();
            inputText = inputText.replace('\r\n', '\n');
            const myMap = new Map();
            console.log("---------");
            const lines = inputText.split('\n'); //'\n');const separator = path.sep;
            const argList = [];
            const processedLines = [];
            let insideProcedure = false;
            var isSuccess = 0;
            var i = 1;
            for (var line of lines) { //lines.forEach(line => {
                if (i === 1) {
                    var convertFlagI = line.indexOf("--CONVERT_SUCCESS");
                    if (convertFlagI < 0) {
                        vscode.window.showErrorMessage('Unable to reverse because CONVERT was not recognized on the first line_ SUCCESS keyword');
                        return;
                    }
                    else {
                        line = line.substring(0, convertFlagI);
                        console.info("line:" + i + ",[DeleteConvertedFlag]->" + line);
                    }
                }
                var dragFlagIndex = line.toLocaleLowerCase().indexOf("--drop proc");
                var match = null;
                if (dragFlagIndex >= 0) {
                    line = line.substring(dragFlagIndex + 2);
                    console.info("line:" + i + ",[Reverse]->" + line);
                    processedLines.push(line);
                }
                else if (match = line.match(/^\s*(--)?\s*(ALTER|CREATE)\s+PROCEDURE|^\s*(--)?\s*(ALTER|CREATE)\s+proc/i)) { // 忽略大小写，允许前面的空格 // 匹配 ALTER procedure 或 ALTER PROCEDURE          if (line.match(/^ALTER\s+procedure/i)) { // 匹配 ALTER procedure 或 ALTER PROCEDURE
                    // if (match=line.match(/^\s*--\s*(ALTER|CREATE)\s+PROCEDURE|^\s*--\s*(ALTER|CREATE)\s+proc/i)) { // 忽略大小写，允许前面的空格 // 匹配 ALTER procedure 或 ALTER PROCEDURE          if (line.match(/^ALTER\s+procedure/i)) { // 匹配 ALTER procedure 或 ALTER PROCEDURE
                    // if (line.match(/^\s*(ALTER|CREATE)\s+PROCEDURE|^\s*(ALTER|CREATE)\s+proc/i)) { // 忽略大小写，允许前面的空格 // 匹配 ALTER procedure 或 ALTER PROCEDURE          if (line.match(/^ALTER\s+procedure/i)) { // 匹配 ALTER procedure 或 ALTER PROCEDURE
                    insideProcedure = true;
                    // const commentIndex = match.index + (match[1] || match[3]).length;
                    const commentIndex = line.lastIndexOf('--', match.index);
                    line = line.substring(commentIndex + 2);
                    processedLines.push(line);
                    console.info("line:" + i + "," + "[存储过程名逆转开始]->" + line);
                    isSuccess++;
                }
                else if (insideProcedure && line.match(/^\s*(--)?\s*AS/i)) {
                    insideProcedure = false;
                    var commentIndex = line.indexOf("--");
                    line = line.substring(commentIndex + 2);
                    console.info("line:" + i + "," + "[存储过程名逆转结束]->" + line);
                    processedLines.push(line);
                    isSuccess++;
                }
                else if (insideProcedure) {
                    var commentI = line.indexOf("--");
                    var commentIX = line.indexOf("--X");
                    var varStartI = line.indexOf("@");
                    if (commentIX >= 0) {
                        line = line.replace("--X", "");
                        processedLines.push(line);
                        isSuccess++;
                        console.info("line:" + i + ",[存储过程参数杂项逆转]->" + line);
                    }
                    else if (commentI >= 0 && varStartI > commentI) {
                        console.info("line:" + i + ",[存储过程参数注释忽略逆转]->" + line);
                        processedLines.push(line);
                        isSuccess++;
                    }
                    else if (varStartI >= 0) { //必须没有注释掉
                        line = line.replace(";", ",");
                        line = line.replace('declare ', '');
                        var outputIndex = line.toLocaleLowerCase().indexOf("--output");
                        if (outputIndex > 0) {
                            var outputName = line.substring(outputIndex, outputIndex + "--output".length);
                            line = line.replace(outputName, outputName.substring(2)); //摘掉--
                        }
                        else {
                            outputIndex = line.toLocaleLowerCase().indexOf("--out");
                            if (outputIndex > 0) {
                                var outputName = line.substring(outputIndex, outputIndex + "--out".length);
                                line = line.replace(outputName, outputName.substring(2)); //摘掉--
                            }
                        }
                        var varEndI = line.indexOf(" ", varStartI + 1);
                        const varName = line.slice(varStartI, varEndI);
                        argList.push(varName);
                        // const alteredLine = line.replace(/output/ig, '--output');
                        processedLines.push(line);
                        console.info("line:" + i + ",[存储过程参数" + varName + "逆转]->" + line);
                        isSuccess++;
                    }
                    else {
                        console.info("line:" + i + ",[存储过程参数杂项忽略逆转]->" + line);
                        processedLines.push(line);
                    }
                }
                else if (line.match(";return;--")) { ///^\s*RETURN/i)) {
                    var findFlag = ";return;--";
                    var findFlagI = line.indexOf(findFlag);
                    if (findFlagI > 0 && line.indexOf("return", findFlagI + findFlag.length) >= 0) { //需要出现2个flag才能算成立
                        isSuccess++;
                        line = line.substring(findFlagI + findFlag.length);
                        console.warn("line:" + i + ",[返回语句逆转]->" + line);
                        processedLines.push(line);
                    }
                    else {
                        console.warn("line:" + i + ",[返回语句无法处理,找不到特定标记]-> " + line);
                        processedLines.push(line);
                    }
                }
                else {
                    processedLines.push(line);
                }
                i++;
            }
            const processedSQL = processedLines.join('\n');
            const convertedText = processedSQL; //inputText.replace(/old_text/g, 'new_text');
            if (isSuccess > 0) {
                vscode.window.showInformationMessage(`Success!Reverse Processed ${isSuccess} line of code in total`);
            }
            else {
                vscode.window.showErrorMessage('Failure!Not Found Match Reverse Stored Procedure');
                return;
            }
            editor.edit(editBuilder => {
                const start = new vscode.Position(0, 0);
                const end = new vscode.Position(document.lineCount, 0);
                const range = new vscode.Range(start, end);
                editBuilder.replace(range, convertedText);
            });
        }
    }
    console.log('Congratulations, your extension "sqlexec" is now active!11');
    context.subscriptions.push(vscode.commands.registerCommand('extension.sqltool.hello', () => {
        vscode.window.showInformationMessage('Hello World from sqlexec!');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.sqltool.convertSql', () => {
        convertSql();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.sqltool.convertSqlReverse', () => {
        convertSqlReverse();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.sqltool.execSql', () => {
        vscode.window.showInformationMessage('not implemention!');
    }));
	/*
    context.subscriptions.push(vscode.commands.registerCommand('sqlconvert.showCurrentConnection', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        azdata.connection.getCurrentConnection().then(connection => {
            let connectionId = connection ? connection.connectionId : 'No connection found!';
            vscode.window.showInformationMessage(connectionId);
        }, error => {
             console.info(error);
        });
    }));
    */
}

// this method is called when your extension is deactivated
export function deactivate() {
}