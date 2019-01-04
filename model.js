"use strict";

const vscode = require("vscode");
const hashmap = require('./hashmap.js')
const path = require("path");
const Marked = require('marked');
const octokit = require('@octokit/rest');
const zenhub = require('./zenhub.js')
const request = require('request-promise-native');


var TypeEnum = {
    GITHUB: "github",
    ORG: "org",
    REPO: "repo",
    PIPELINE: "pipeline",
    LABEL: "label",
    ISSUE: "issue",
    ISSUE_CLOSED: "issue-closed",
    PR: "pr",
    SUBTASK: "subtask",
    PENDING: "pending",
    DONE: "done"
};

/*
  Class Base
*/
class Base extends vscode.TreeItem {
    constructor(type, label, github) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.github = github;
        this.setIcon(type);
    }

    setIcon(type) {
        this.type = type;
        this.contextValue = type;
        switch (type) {
            case TypeEnum.ORG:
                this.iconPath = this.github.rootPath + "/" + path.join('icons', 'organization.svg');
                break;
            case TypeEnum.REPO:
                this.iconPath = this.github.rootPath + "/" + path.join('icons', 'repo.svg');
                break;
            case TypeEnum.PIPELINE:
                this.iconPath = this.github.rootPath + "/" + path.join('icons', 'arrow-small-right.svg');
                break;
            case TypeEnum.LABEL:
                this.iconPath = this.github.rootPath + "/" + path.join('icons', 'tag.svg');
                break;
            case TypeEnum.ISSUE:
                this.iconPath = this.github.rootPath + "/" + path.join('icons', 'issue-opened.svg');
                break;
            case TypeEnum.ISSUE_CLOSED:
                this.iconPath = this.github.rootPath + "/" + path.join('icons', 'check.svg');
                break;
            case TypeEnum.PR:
                this.iconPath = this.github.rootPath + "/" + path.join('icons', 'git-pull-request.svg');
                break;
            case TypeEnum.SUBTASK:
                this.iconPath = this.github.rootPath + "/" + path.join('icons', 'list-unordered.svg');
                break;
            case TypeEnum.DONE:
                this.iconPath = this.github.rootPath + "/" + path.join('icons', 'check.svg');
                break;
        }
    }

    setUrl(url) {
        this.command = {
            title: 'Open',
            command: 'mygithubissues.open',
            arguments: [url]
        };
    }
}

/*
  Class Github
*/
class Github extends Base {

    constructor(config, rootPath) {
        super(TypeEnum.GITHUB, config.host, null);
        this.iconPath = rootPath + "/" + path.join('icons', 'mark-github.svg');
         this.name = config.host;
        this.username = config.username;

        if (this.name !== 'github.com') {
            this.baseGitUrl = 'https://' + this.name + '/api/v3';
        } else {
            this.baseGitUrl = 'https://api.github.com';
        }
        this.gittoken = config.token;
        this.gitapi = new octokit({ baseUrl: this.baseGitUrl });
        this.gitapi.authenticate({
            type: 'token',
            token: config.token,
        });

        this.zenapi = null;
        if (config.zenhub && (config.zenhub.host !== "") && config.zenhub.token !== "") {
            this.zenapi   = new zenhub(config.zenhub.host, config.zenhub.token);
        }

        this.rootPath = rootPath;
        this.baseUrl  = "https://" + config.host ;
        this.setUrl(this.baseUrl);

        // Last thing done in the constructor
        this.orgs     = new hashmap();
        this.buildTree(config.orgs);
    }

    buildTree(orgs) {
        if (orgs) {
            return orgs.reduce( (hmap, org) => {
                hmap.put(org.name, new Organization(org.name, org.repos, this));
                return hmap;
            }, this.orgs);
        }
    }

    ZenApi() {
        if (this.zenapi) {
            return this.zenapi;
        } else {
            return null;
        }
    }

    GitApi() {
        return this.gitapi;
    }

    getChildren() {
        return this.orgs.values();
    }
}

/*
  Class Organization
*/
class Organization extends Base {

    constructor(org, repos, github) {
        super(TypeEnum.ORG, org, github);
        this.owner = org;
        this.repos = this.buildTree(repos);
        this.setUrl(github.baseUrl + "/" + org);
    }

    buildTree(repos) {
        return repos.reduce( (hmap, repo) => {
            let p_repoId = this.getRepoId(repo);
            p_repoId
                .then( (id) => {
                    hmap.put(repo, new Repo(this.owner, repo, p_repoId, this.github)); })
                .catch( (e) => { });
            return hmap;
        }, new hashmap());
    }

    getChildren() {
        return this.repos.values();
    }

    getRepoId(repo) {
        return this.github.GitApi().repos.get({
            owner: this.owner, repo: repo
           }).then( (result) => {
               return result.data.id;
           });
    }
}

/*
  Class Repo
*/
class Repo extends Base {
    constructor(org, repo, p_repoId, github) {
        super(TypeEnum.REPO, repo, github);
        this.repo = repo;
        this.owner = org;
        this.setUrl(github.baseUrl + "/" + this.owner + "/" + repo);
        this.p_repoId = p_repoId;
        this.refresh();
    }

    getAssignedIssues() {
        return this.github.GitApi().issues.listForRepo({
            owner: this.owner,
            repo: this.repo,
            assignee: this.github.username
        }).then( (result) => {
            return result.data.reduce( (hmap, issue) => {
                hmap.put(issue.number, new Issue(issue, this.getRepoId(), this.github));
                return hmap;
            }, new hashmap());
        }).catch( (err) => {
            console.log("---> " +err);
        });
    }
    
    getRepoId() {
        return this.p_repoId;
    }

    async getPipeline() {
        
        if (!this.github.ZenApi()) {
            return null;
        }
        
        let result = await this.getRepoId();
        let board = await this.github.ZenApi().getBoard({
            repo_id: result
        });
        if (!board) {
            return null;
        }

        let m = await this.p_myIssues;
        let pr = new Pipeline("Pull Requests", null, this.github);
        let pp = board.pipelines.map( (pipeline) => {
            return new Pipeline(
                pipeline.name, 
                pipeline.issues.reduce((list, issue) => {
                    if (m.containsKey(issue.issue_number)) {
                        let i = m.get(issue.issue_number);
                        i.isEpic = issue.is_epic;
                        if (i.type === TypeEnum.PR) {
                            pr.addIssue(i)
                        } else {
                            list.push(i);
                        }
                    }
                    return list;
                }, []),
                this.github);
        })
        pp.push(pr);
        return pp;
    }

    async getChildren() {
        let p = await this.p_myPipelines;
        if (p) {
            return p;
        }
        return (await this.p_myIssues).values();
    }

    refresh() {
        this.p_myIssues = this.getAssignedIssues();
        this.p_myPipelines = this.getPipeline();
    }
}

class Pipeline extends Base {
    constructor(name, issues, github) {
        super(TypeEnum.PIPELINE, name, github);
        this.issues = issues;
    }

    getChildren() {
        return this.issues;
    }

    addIssue(issue) {
        if (!this.issues) {
            this.issues = [];
        }
        this.issues.push(issue);
    }
}

function getType(issue) {
    let type = (issue.state !== 'closed' ) ? TypeEnum.ISSUE : TypeEnum.ISSUE_CLOSED;
    type = (issue.pull_request) ? TypeEnum.PR : type;
    return type;
}

function getTitle(issue) {
    let title = "#"+issue.number+": "+issue.title; 
    if (getType(issue) !== TypeEnum.PR) {
        return title;
    } else {
        let today = new Date();
        let updated = new Date(issue.updated_at);
        let diffDays = Math.floor((today.getTime() - updated.getTime()) / (3600 * 24 * 1000)); // exact dates
        let diffHrs = Math.floor((today.getTime() - updated.getTime()) / (3600 * 1000)); // exact dates
        if (diffDays >= 0) {
            title = title + " - (" + diffDays + " days ago)";
        } else {
            title = title + " - (" + diffHrs + " hrs ago)";
        }
        return title;
    }
}

class Issue extends Base { 
    constructor(issue, p_repoId, github) {
        super(getType(issue), getTitle(issue), github);
        this.subtasks = null;
        this.issues = null;
        this.p_repoId = p_repoId;
        let res = issue.repository_url.split('/')
        this.owner = res[res.length - 2 ];
        this.repo = res[res.length - 1 ];
        this.number = issue.number;
        this.update(issue);
    }

    update(issue) {
        this.tooltip = issue.body;
        this.setUrl(issue.html_url);
        this.body = issue.body;
        this.isEpic = false;
        this.setIcon(getType(issue))
        this.label = getTitle(issue);
    }

    getChildren() {
        return this.buildTree();
    }

    buildTree() {
        if (this.isEpic) {
            this.issues = this.getEpicLists();
            return this.issues.then ( (l) => { return l; });
        } else {
            this.subtasks = this.parseSubTasks(this.body);
            return this.subtasks;
        }
    }

    refresh() {
        this.github.GitApi().issues.get({
            owner: this.owner,
            repo: this.repo,
            number: this.number
        }).then( (result) => {
            this.update(result.data);
            this.buildTree();
        })
    }

    parseSubTasks(body) {
        let tokens = Marked.lexer(body);
        let hmap = new hashmap();
        hmap.put("items", []);
        return tokens.reduce( (hmap, node) => {
            if (node.type === 'list_item_start' && node.task) {
                hmap.put("found", node.checked);
            } else if (node.type === 'list_item_end') {
                hmap.remove("found");
            } else if (hmap.containsKey("found") && node.type === 'text') {
                let checked = hmap.get("found");
                if (checked) {
                    hmap.get("items").push(new Item(node.text, checked, this.github));
                } else {
                    hmap.get("items").unshift(new Item(node.text, checked, this.github));
                }
            }
            return hmap
        }, hmap).get("items");
    }

    async getEpicLists() {
     
        let id = await this.p_repoId;
        let data = await this.github.ZenApi().getEpicData({ repo_id: id, epic_id: this.number });
        
        let pp = []
        for (let issue of data.issues) {
            let owner = this.owner;
            let repo = this.repo;

            if (id !== issue.repo_id) {
                let resp = await request({
                    headers: {
                      'authorization': 'token ' + this.github.gittoken
                    },
                    uri: this.github.baseGitUrl + "/repositories/"+issue.repo_id,
                    json: true,
                    method: 'GET'
                });
                owner = resp.organization.login;
                repo = resp.name;
            }
            
            pp.push(this.github.GitApi().issues.get({
                owner: owner, 
                repo: repo, 
                number: issue.issue_number}));
        
        }

        let results = await Promise.all(pp);
        return results.map( (r) => {
            return new Issue(r.data, this.p_repoId, this.github);
        })
    }
}

class Item extends Base {
    constructor(item, checked, github) {
        if (checked) {
            super(TypeEnum.DONE, item, github);
        } else {
            super(TypeEnum.PENDING, item, github);
        }
    }

    getChildren(parent) {
        return null;
    }
}

module.exports = {
    Github: Github,
    Organization: Organization,
    Repo: Repo,
    Pipeline: Pipeline,
    Issue: Issue,
    Item: Item
}
