"use strict";

const git = require('./api.js');

var api = new git.GitHub({
    host: "github.com",
    token: "",
    username: "isayyid",
    zenhub: {
        host: "zenhub.com",
        token: ""
    },
    orgs: [
        {
            name: "isayyid",
            repos: ["bin", "mydocs"]
        }
    ]
});


function Show(parent, space) {
    console.log(space + parent.name);
    let children = parent.getChildren();
    if (children) {
        if (children instanceof Promise) {
            children.then( (list) => {
                for (let c of list) {
                    Show(c, space + "  ");
                }
            });
        } else if (children) {
            for (let child of parent.getChildren()) {
                Show(child, space + "  ");
            }
        }
    }
    
}

Show(api, "");
