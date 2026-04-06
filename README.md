# CPP Code Editor

A minimal desktop C++ code editor built using Electron, React, and Monaco Editor, with an integrated terminal and workspace support.

---

## Features

* Monaco Editor (VS Code–like editing experience)
* Compile and run C++ using `g++`
* Integrated terminal and output panel
* Workspace explorer

  * Create and delete files and folders
* Snippet system

  * Save and insert reusable code snippets
  * Searchable snippet picker
* Global settings via `settings.json`

---

## Installation and Run

```bash
npm install
npm run dev
```

---

## Requirements

* `g++` must be installed and available in your system `PATH`
* `node` must be installed and available in your system `PATH`
* Terminal behavior may vary depending on the host system

---

## Global CLI Command Setup

You can run the editor from any terminal using:

```bash
ccpp
```

### Steps to Configure

#### 1. Ensure the launcher file exists

Make sure you have a file named:

```
ccpp.cmd
```

This file should be placed inside your project directory.

---

#### 2. Add project directory to PATH

You need to add the folder containing `ccpp.cmd` to your system `PATH`.

---

#### 3. Open Environment Variables

* Press `Win + S`
* Search for **Environment Variables**
* Open **Edit the system environment variables**
* Click **Environment Variables**

---

#### 4. Edit PATH

* Under **User variables**, select `Path`
* Click **Edit**
* Click **New**
* Add the full path to your project directory (the folder containing `ccpp.cmd`)
* Click **OK** to save all changes

---

#### 5. Restart Terminal

Close and reopen your terminal (Command Prompt, PowerShell, or VS Code terminal)

---

#### 6. Run the command

```bash
ccpp
```

---

## How it Works

* `ccpp.cmd` launches the Electron application
* Adding the directory to `PATH` makes the command globally accessible
* This allows the editor to be launched from any terminal location

---

## Future Improvements

* Packaging as a standalone executable
* Custom themes
* Enhanced IntelliSense support
* Plugin system

---

## Author

Siddharth Jaswal
