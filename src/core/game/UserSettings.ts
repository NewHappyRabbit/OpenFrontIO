export class UserSettings {
  private get(key: string, defaultValue: boolean) {
    const value = localStorage.getItem(key);

    if (!value) return defaultValue;

    if (value === "true") return true;

    return false;
  }

  emojis() {
    return this.get("settings.emojis", true);
  }

  darkMode() {
    return this.get("settings.darkMode", false);
  }

  toggleEmojis() {
    localStorage.setItem("settings.emojis", (!this.emojis()).toString());
  }

  toggleDarkMode() {
    localStorage.setItem("settings.darkMode", (!this.darkMode()).toString());
  }
}
