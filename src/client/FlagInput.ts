import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import Countries from "./data/countries.json";
import { UserSettings } from "../core/game/UserSettings";

const flagKey: string = "flag";

@customElement("flag-input")
export class FlagInput extends LitElement {
  @state() private flag: string = "";
  @state() private search: string = "";
  @state() private showModal: boolean = false;
  private userSettings: UserSettings = new UserSettings();

  static styles = css`
    .hidden {
      display: none;
    }

    .flag-container {
      display: flex;
      position: relative;
    }

    .flag-button {
      display: flex;
      border: 1px solid rgba(0, 0, 0, 0.3);
      background: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      padding: 4px;
      border-radius: 8px;
    }

    .dark-mode .flag-button {
      background: rgba(55, 65, 81, 0.7);
    }

    .selected-flag {
      width: 48px;
    }

    .flag-modal {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      position: absolute;
      top: 60px;
      left: 0;
      width: 560px;
      height: 500px;
      max-height: 50vh;
      background-color: rgb(35 35 35 / 0.8);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
      padding: 10px;
      border-radius: 8px;
      z-index: 3;
    }

    .flag-search {
      height: 2rem;
      border-radius: 8px;
      border: none;
      text-align: center;
      font-size: 1.3rem;
    }

    .dark-mode .flag-search {
      background: rgb(55, 65, 81);
      color: white;
      border: 1px solid rgb(209, 213, 219);
    }

    .flag-dropdown {
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-evenly;
      gap: 1rem;
    }

    .dropdown-item {
      opacity: 0.7;
      width: calc(100% / 4 - 15px);
      text-align: center;
      color: white;
      cursor: pointer;
      border: none;
      background: none;
    }

    .dropdown-item:hover {
      opacity: 1;
    }

    .country-flag {
      width: 100%;
      height: auto;
    }

    @media (max-width: 768px) {
      .flag-modal {
        width: 80vw;
      }

      .dropdown-item {
        width: calc(100% / 3 - 15px);
      }
    }
  `;

  private handleSearch(e: Event) {
    this.search = String((e.target as HTMLInputElement).value);
  }

  private setFlag(flag: string) {
    this.flag = flag;
    this.showModal = false;
    this.storeFlag(flag);
  }

  public getCurrentFlag(): string {
    return this.flag;
  }

  private getStoredFlag(): string {
    const storedFlag = localStorage.getItem(flagKey);
    if (storedFlag) {
      return storedFlag;
    }
    return "";
  }

  private storeFlag(flag: string) {
    if (flag) {
      localStorage.setItem(flagKey, flag);
    } else if (flag === "") {
      localStorage.removeItem(flagKey);
    }
  }

  private dispatchFlagEvent() {
    this.dispatchEvent(
      new CustomEvent("flag-change", {
        detail: { flag: this.flag },
        bubbles: true,
        composed: true,
      }),
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this.flag = this.getStoredFlag();
    this.dispatchFlagEvent();
  }

  render() {
    return html`
      <div
        class="flag-container ${this.userSettings.darkMode()
          ? "dark-mode"
          : ""}"
      >
        <button
          @click=${() => (this.showModal = !this.showModal)}
          class="flag-button"
          title="Pick a flag!"
        >
          <img class="selected-flag" src="/flags/${this.flag || "xx"}.svg" />
        </button>
        ${this.showModal
          ? html`
              <div class="flag-modal ${this.showModal ? "" : "hidden"}">
                <input
                  class="flag-search"
                  type="text"
                  placeholder="Search..."
                  @change=${this.handleSearch}
                  @keyup=${this.handleSearch}
                />
                <div class="flag-dropdown">
                  <!-- Show each flag as button -->
                  <button
                    @click=${() => this.setFlag("")}
                    class="dropdown-item"
                  >
                    <img class="country-flag" src="/flags/xx.svg" />
                    <span class="country-name">None</span>
                  </button>
                  ${Countries.filter(
                    (country) =>
                      country.name
                        .toLowerCase()
                        .includes(this.search.toLowerCase()) ||
                      country.code
                        .toLowerCase()
                        .includes(this.search.toLowerCase()),
                  ).map(
                    (country) => html`
                      <button
                        @click=${() => this.setFlag(country.code)}
                        class="dropdown-item"
                      >
                        <img
                          class="country-flag"
                          src="/flags/${country.code}.svg"
                        />
                        <span class="country-name">${country.name}</span>
                      </button>
                    `,
                  )}
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }
}
