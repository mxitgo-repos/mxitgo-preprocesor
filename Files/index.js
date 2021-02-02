class constants {

    constructor() {

        this.oValues = {

            GET: "GET",
            blob: "blob",
            gitHubContributor: "Ponchit0021",
            gitHubRepo: "bh-html-dev",
            unzippedRoute: "bh-html-dev",
            routeToMainZip: "https://github.com/Ponchit0021/bh-html-dev/archive/master.zip",
            mimeType: "application/zip",
            mimeTypeHTML: "text/html",
            mainZipName: "master.zip",

            fileDowloadURL: `$${env.fileDowloadURL}`,

            gitHubApiURL: `$${env.gitHubApiURL}`,

            jsonType: "application/json",
            token: "token 56f94266cfadadd7dbd8927341788d14bb6e3d03"


        }

    }

    getValues() {
        return this.oValues;
    }

    setMasterFolder(sMasterFolder) {
        this.oValues.masterFolder = sMasterFolder;
    }


}

window.constants = new constants();