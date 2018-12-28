"use strict";

const vscode = require("vscode");
const model = require("./model.js");
const { exec } = require("child_process");


class MyGithubIssues {
   
    constructor(context) {
        const subscriptions = context.subscriptions;
        subscriptions.push(vscode.commands.registerCommand('mygithubissues.open', this.open, this));
        subscriptions.push(vscode.commands.registerCommand('mygithubissues.refresh', this.refresh, this));

        let config = vscode.workspace.getConfiguration('mygithubissues');

        this.gits = config.get('github').map( (git) => {
            if (git.host !== "" && git.token !== "" && git.username !== "") {
                return new model.Github(git, context.asAbsolutePath(''));
            }
        });
 
        exec('git config --get remote.origin.url', (error, stdout, stderr) => {
            if (error === null) {
                for (let git of this.gits) {
                    let index = stdout.search(git.label);
                    if (index === -1) {
                        continue
                    }

                    let s = stdout.slice(index+git.label.length + 1, stdout.length-5);
                    let [owner, repo] = s.split('/');

                    if (git.orgs.containsKey(owner)) {
                        let org = git.orgs.get(owner);
                        
                        if (!org.repos.containsKey(repo)) {
                            org.repos.put(repo, new model.Repo(owner, repo, org.getRepoId(repo), git));
                        }
                    } else {
                        git.orgs.put(owner, new model.Organization(owner, [ repo ], git));
                    }
                    break
                }
            }
        });

       //console.log(this.gits);

        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getChildren(element) {
        if (element) {
            return element.getChildren();
        }
        return this.gits;
    }

    getTreeItem(element) {
        return element;
    }

    open(linkurl) {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(linkurl));
    }

    refresh(node) {
        node.refresh();
        this._onDidChangeTreeData.fire();
    }

}


exports.MyGithubIssues = MyGithubIssues;