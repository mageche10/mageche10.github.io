---
title: Notes Manager - An Electron app to organize and compile LaTeX lecture notes
description: Discover how I built a Windows desktop app with Electron to organize, edit, and compile LaTeX lecture notes efficiently. Learn about its features, workflow, and code highlights.
date: 2025-08-21 14:06:30
tags: [Desktop application, Productivity]
categories: [projects]
featured_image: /images/notes_hub_main.png
---

> I built a Windows desktop application with [Electron](https://www.electronjs.org/) to keep all my class notes organized, searchable, and editable. In this post I’ll walk you through the main ideas behind the project, why I made it, and some highlights of its implementation, Check the full code [here](https://github.com/mageche10/apunts-manager).

## Motivation

As a student, I take all my notes in [**LaTeX**](https://www.latex-project.org/) (I’ll explain my full workflow in another post). Over time, I ended up with dozens of documents - chapters, images, and different subjects. Managing them became a nightmare and, on top of that, a huge waste of time.

That’s why I decided to build my own **Notes Manager with Electron**:
- Organize notes by subject.
- Create new notes quickly.
- Compile them all into a single PDF (optionally adding cover pages).
- View only a single chapter if I want.
- Track errata.
- Manage images and edit them in [**Inkscape**](https://inkscape.org/).
- Customize the main color of each subject without editing complicated configuration files.

## App Structure and Workflow

As I mentioned, I take my notes with LaTeX, using a fully customized [**Visual Studio Code**](https://code.visualstudio.com/) environment. I have a full LaTeX distribution installed on my computer, ready to compile my files. To view the generated PDFs, I use [**Sumatra PDF**](https://www.sumatrapdfreader.org/free-pdf-reader), a lightweight PDF viewer. For editing images in my notes, I use [Inkscape](https://inkscape.org/).

I’ve brought all these tools together in a centralized environment: my own Notes Manager app. To build it, I used [Electron](https://www.electronjs.org/), a framework for building desktop applications with JavaScript, HTML, and CSS. I also used [Bootstrap](https://getbootstrap.com/) to create a simple UI. When you open the app, you can see this interface:

!["Screenshot of the Notes Manager app main interface showing subject navigation and organized LaTeX files."](/images/notes_hub_main.png)

On the left, there’s a sidebar to select the desired subject. You can also generate an errata sheet to fix mistakes later or access the main configuration of the app. The main window displays all the different files for the selected subject (usually organized by chapters or topics) and their titles.

Each file can be **edited**, **viewed**, and **deleted**. You can also **reorder** files, change the main color of the subject, **compile** all the files to generate a main subject PDF, **track errata**, or add a new file.

As you can see, the app also has a second tab: **Figures**. Here you can view and edit all the images that appear in your notes. There’s also an option to copy the LaTeX code for inserting the figure to the clipboard.

!["Screenshot of the Figures tab in Notes Manager, displaying and editing images used in LaTeX notes."](/images/notes_hub_figures.png)

### Internal Structure

The main folders of the project are organized as follows:

project-root/  
├── main.js # Electron entry point  
├── renderer/ # UI logic  
├── styles/ # Bootstrap-generated CSS files  
├── preload.js # Bridge between UI and Node core  
└── temesManager.js & configManager.js # API functions and main functionality

## A Glimpse at the Code

The entry point for Electron (*main.js* file) is pretty simple. We only customize the window a little and load all API functions.

```javascript
let win

const createMainWindow = (width = 1100, height = 700) => {
    win = new BrowserWindow({
        width: width,
        height: height,
        show: false, 
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.setMenuBarVisibility(false)
    win.loadFile('index.html')
}

app.whenReady().then(async () => {
    await ConfigManager.checkFile();
    
    await loadConfigApi()
    await loadMainApi()

    registerGlobalShortcuts()
    win.show()

    createMainWindow()
})
```

### IpcRenderer: Node Isolation

When building an Electron app, it’s essential to separate the UI code from the main functionality. This prevents the renderer from having direct access to Node.js features, which may run with elevated privileges; isolating it makes the app less vulnerable to malware. In other words, to run Node.js code from UI actions (for example, launching VS Code on a button press), you need a bridge (the [**ipcRenderer**](https://www.electronjs.org/es/docs/latest/api/ipc-renderer)) that tells Node which predefined function to run; and that’s where *preload.js* comes in. Here’s an example:

```javascript
contextBridge.exposeInMainWorld('api', {
    getAllFiles: (subjectCode) => ipcRenderer.invoke('getAllFiles', subjectCode),
    getAllFigures: (subjectCode) => ipcRenderer.invoke('getAllFigures', subjectCode),
    initSubject: (subjectCode) => ipcRenderer.invoke("initSubject", subjectCode),
})
```

These functions are invoked from the UI thread (like the code below) and handled in the main process, which performs any operation that requires Node.js (file I/O, launching external programs, etc.).

```javascript
const files = await window.api.getAllFiles(subject.code)
```

And are handled in the main pipeline like this:

```javascript
ipcMain.handle('getAllFiles', async (event, subjectCode) => { return await getAllFiles(subjectCode) })

async getAllFiles(subjectCode) {
    // Any code that requires Node.js functions
    // For example: using the fs module to perform file-related actions
}
```

### Persistence of Data and Configuration

Since the application only needs to store a small amount of data—mainly program paths, file locations, and the list of subjects—I use a simple JSON file for this purpose. The file has the following structure:

```json
subjects: [
    {
        nom: "Subject I",
        abb: "SUB I"
    }
],
dataPath: "",
VSEnvPath: "",
DefaultOutputPath: "",
InkscapePath: "",
SumatraPath: "",
colorMap: [
    { name: "Taronja", primary: "0xFFF1E6", secondary: "0xFF9233" },
    { name: "Vermell", primary: "0xFFE6E6", secondary: "0xFF3333" },
    { name: "Violeta", primary: "0xF0E6FF", secondary: "0xA366FF" },
    { name: "Groc", primary: "0xFFFFE6", secondary: "0xFFD333" },
    { name: "Blau", primary: "0xE6F2FF", secondary: "0x3399FF" },
    { name: "Verd", primary: "0xDCF5E5", secondary: "0x58C75F" }
]
```

I can read and write this data with simple functions like these:

```javascript
getAllConfig (){
    return JSON.parse(fs.readFileSync(configPath, "utf-8"))
},

changeEntry (entry, value){
    try {
        configObj = this.getAllConfig()
        configObj[entry] = value
        fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2))
        return true
    } catch (err) {
        return false
    }
},
```

### Compiling LaTeX Documents from Code

One of the most important features of the app is the ability to compile the LaTeX documents I write. The main use cases are:
- Compile a single topic (i.e., one file).
- Compile an entire subject.
- Compile all subjects, each with its own cover page.

Each type of compilation requires, on one hand, editing a **master.tex** file to include the desired files, and on the other hand, performing the compilation itself. For compiling, I use Node's native *exec* function. After creating a helper function to promisify it, the code looks like this:

```javascript
const execPromise = (cmd, opts = {}) => {
    return new Promise((resolve, reject) => {
        exec(cmd, opts, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message)
            } else {
                resolve(true)
            }
        })
    })
}

const cmdCompile = `latexmk -f -gg -pdf -interaction=nonstopmode "${masterPath}" -output-directory="${dirPath}"`
await execPromise(cmdCompile, {cwd: dirPath})
```

### Global Shortcuts

Electron can register [global shortcuts](https://www.electronjs.org/docs/latest/api/global-shortcut) that work even if the app is not focused. I use this feature to add figures to my LaTeX documents quickly: pressing *Alt+ctrl+F*, focuses the app and opens a dialog to enter the figure name. Then it opens a new inkscape file to edit the image and it copies to the clipboard the Latex code to insert the figure. You can implement global shortcuts inserting this code on *main()*: 

```javascript
function registerGlobalShortcuts() {
    globalShortcut.register('Control+Alt+F', () => {
        win.focus()
        win.webContents.send('new-figure-shortcut')
    })
}
```

Then you have to add to *preload.js*

```javascript
contextBridge.exposeInMainWorld('rendererApi', {
    newFigureShortcut: (callback) => ipcRenderer.on('new-figure-shortcut', (event, data) => { callback(data) })
})
```

and call in your renderer pipeline:

```javascript
window.rendererApi.newFigureShortcut(async () => {
    // Some functionality
})
```

## Conclusions

With this program, I have a fully customizable environment for managing my notes and I can work much more efficiently. Since I take my notes live during class, I need a fast workflow to keep up with the professor's explanations.

Check out the full code in the [GitHub repo](https://github.com/mageche10/apunts-manager)

Stay tuned for upcoming posts, where I’ll share a detailed tutorial on **how I take notes in LaTeX**.
