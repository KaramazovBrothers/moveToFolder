import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
} from "obsidian";

// Структура одного правила
interface Rule {
  keyword: string;
  folder: string;
  position: "start" | "middle" | "end";
}

interface PluginSettings {
  rules: Rule[];
}

const DEFAULT_SETTINGS: PluginSettings = {
  rules: [],
};

export default class MoveToFolderPlugin extends Plugin {
  settings: PluginSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new MoveToFolderSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("file-open", this.handleNewFile.bind(this))
    );
  }

  async handleNewFile(file: TFile | null) {
    if (!file || !(file instanceof TFile)) return;

    console.log("🔔 New file detected:", file.basename);

    const fileName = file.basename;

    for (const rule of this.settings.rules) {
      const { keyword, folder, position } = rule;

      let isMatch = false;

      if (position === "start" && fileName.startsWith(keyword)) {
        isMatch = true;
      } else if (position === "end" && fileName.endsWith(keyword)) {
        isMatch = true;
      } else if (position === "middle" && fileName.includes(keyword)) {
        isMatch = true;
      }

      if (isMatch) {
        let finalName = file.name.endsWith(".md") ? file.name : `${file.name}.md`;
        const newPath = normalizePath(`${folder}/${finalName}`);

        // Создаём папку, если её нет
        const folderExists = await this.app.vault.adapter.exists(folder);
        if (!folderExists) {
          await this.app.vault.createFolder(folder);
        }

        try {
          await this.app.fileManager.renameFile(file, newPath);
          console.log(`Moved to: ${newPath}`);
        } catch (err) {
          console.error("Move failed:", err);
        }

        return; // Только по первому совпадению
      }
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class MoveToFolderSettingTab extends PluginSettingTab {
  plugin: MoveToFolderPlugin;

  constructor(app: App, plugin: MoveToFolderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
display(): void {
  const { containerEl } = this;
  containerEl.empty();

  containerEl.createEl("h2", { text: "Move To Folder: Rules" });

  // Шапка таблицы
  const headerRow = containerEl.createEl("div");
  headerRow.style.display = "flex";
  headerRow.style.gap = "8px";
  headerRow.style.fontWeight = "bold";
  headerRow.style.margin = "0 0 8px 0";

  const col1 = headerRow.createEl("div", { text: "File name contains" });
  const col2 = headerRow.createEl("div", { text: "Destination folder" });
  const col3 = headerRow.createEl("div", { text: "Position" });

  [col1, col2, col3].forEach(col => {
    col.style.flex = "1";
  });

  this.plugin.settings.rules.forEach((rule, index) => {
    const row = containerEl.createEl("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.marginBottom = "8px";

    // Keyword
    const col1 = row.createEl("div");
    col1.style.flex = "1";
    new Setting(col1)
      .addText(text =>
        text
          .setPlaceholder("e.g., UA")
          .setValue(rule.keyword)
          .onChange(async value => {
            this.plugin.settings.rules[index].keyword = value;
            await this.plugin.saveSettings();
          })
      );

    // Folder
    const col2 = row.createEl("div");
    col2.style.flex = "1";
    new Setting(col2)
      .addText(text =>
        text
          .setPlaceholder("e.g., Work")
          .setValue(rule.folder)
          .onChange(async value => {
            this.plugin.settings.rules[index].folder = value;
            await this.plugin.saveSettings();
          })
      );

    // Position
    const col3 = row.createEl("div");
    col3.style.flex = "1";
    new Setting(col3)
      .addDropdown(dropdown =>
        dropdown
          .addOption("start", "Start")
          .addOption("middle", "Middle")
          .addOption("end", "End")
          .setValue(rule.position)
          .onChange(async (value: "start" | "middle" | "end") => {
            this.plugin.settings.rules[index].position = value;
            await this.plugin.saveSettings();
          })
      )
      .addExtraButton(btn =>
        btn
          .setIcon("trash")
          .setTooltip("Delete Rule")
          .onClick(async () => {
            this.plugin.settings.rules.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          })
      );
  });

  // Кнопка добавления
  new Setting(containerEl).addButton(btn =>
    btn
      .setButtonText("Add Rule")
      .setCta()
      .onClick(async () => {
        this.plugin.settings.rules.push({
          keyword: "",
          folder: "",
          position: "start",
        });
        await this.plugin.saveSettings();
        this.display();
      })
  );
}
}
