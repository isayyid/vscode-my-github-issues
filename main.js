"use strict";

const git = require('./api.js');

var api = new git.GitHub({
    host: "github.ibm.com",
    token: "74dc7f36a89fddf1b095f60d57919b4e3bea48b2",
    username: "isayyid",
    zenhub: {
        host: "zenhub.ibm.com",
        token: "96690e0097a3928c4a6ca6d43c281870bb1b4fd6d2125e13ee3ccc4741620b616947ef92eb22234e"
    },
    orgs: [
        {
            name: "htap-ng",
            repos: [ "htap-ng"]
        },
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
