// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const git = require("./mygithubissues.js");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {

    vscode.window.registerTreeDataProvider('mygithubissues', new git.MyGithubIssues(context));

}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;