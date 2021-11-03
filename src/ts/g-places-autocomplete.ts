/* eslint-disable @typescript-eslint/no-explicit-any */
class GPlacesAutocomplete {
  service: any;
  sessionToken: any;

  cache = 24 * 60 * 60;
  cacheKey = "GPlacesAutocomplete";
  delay = 300;
  minChar = 1;
  requestOptions: any = {};
  trimValue = true;
  useSessionToken = false;
  useSessionTokenKey = "GPlacesAutocompleteSessionTokenKey";

  autocompleteWrap: any;
  autocompleteList: any;
  autocompleteListBefore: any;
  autocompleteInput: any;
  autocompleteValue = "";

  selectorListClass = "g-places-autocomplete-list";
  selectorItemClass = "g-places-autocomplete-item";
  selectorInput = ".g-places-autocomplete";

  hasAutocompleteList = false;

  constructor(
    options: {
      cache?: number;
      delay?: number;
      minChar?: number;
      requestOptions?: any;
      selector?: string;
      trimValue?: boolean;
      useSessionToken?: boolean;
    } = {}
  ) {
    this.cache = options?.cache ?? this.cache;
    this.delay = options?.delay ?? this.delay;
    this.minChar = options?.minChar ?? this.minChar;
    this.requestOptions = options?.requestOptions ?? this.requestOptions;
    this.selectorInput = options?.selector ?? this.selectorInput;
    this.trimValue = options?.trimValue ?? this.trimValue;
    this.useSessionToken = options?.useSessionToken ?? this.useSessionToken;
    this.init();
  }

  init = () => {
    const { google } = window;
    const places = google?.maps?.places;
    if (!places) {
      console.error(
        "g-places-autocomplete: Google Maps Places API library must be loaded. See: ..."
      );
      return;
    }
    this.service = new places.AutocompleteService();
    this.getSessionToken();

    const inputs = document.querySelectorAll(this.selectorInput);
    inputs.forEach((input) => {
      const parent = input.parentElement;
      if (!parent) {
        return;
      }
      const ul = document.createElement("ul");
      ul.setAttribute("class", this.selectorListClass);
      ul.style.display = "none";
      ul.style.position = "absolute";
      ul.style.top = "100%";
      ul.style.left = "0";
      ul.style.right = "0";
      ul.style.zIndex = "999";
      ul.style.paddingLeft = "0";
      parent.appendChild(ul);
      parent.style.position = "relative";
      input.addEventListener("focus", this.handleFocus);
      input.addEventListener("click", this.handleFocus);
      input.addEventListener("blur", this.handleBlur);
      input.addEventListener(
        "input",
        this.debounce(this.handleInput, this.delay)
      );
      input.addEventListener("keydown", this.handleKeyDown);
      document.addEventListener("click", this.handleClickOutside);
    });
  };

  handleClickOutside = () => {
    if (
      this.autocompleteListBefore &&
      this.autocompleteListBefore !== this.autocompleteList
    ) {
      this.autocompleteListBefore.style.display = "none";
    }
  };

  handleFocus = (e: any) => {
    this.autocompleteWrap = e.target.parentElement;
    this.autocompleteList = this.autocompleteWrap.querySelector(
      `.${this.selectorListClass}`
    );
    this.autocompleteInput = e.target;
    this.autocompleteInput.select();
    this.autocompleteValue = e.target.value;
    this.showAutocompleteList();
    this.unsetIndex();
    const placeId = this.autocompleteInput.getAttribute("data-place-id");
    this.autocompleteList
      .querySelector(`.${this.selectorItemClass}[data-place-id="${placeId}"]`)
      ?.classList.add("active");
  };

  handleBlur = () => {
    this.autocompleteListBefore = this.autocompleteList;
    this.autocompleteList = null;
  };

  handleInput = (e: any) => {
    const inputValue = e.target.value;
    const inputValueTrim = inputValue.trim();

    this.autocompleteValue = inputValue;
    this.autocompleteInput.removeAttribute("data-place-id");
    this.autocompleteInput.removeAttribute("data-state");
    this.autocompleteWrap.removeAttribute("data-state");

    if (inputValue.length < this.minChar) {
      return;
    }

    if (
      this.trimValue &&
      inputValue !== inputValueTrim &&
      inputValue !== `${inputValueTrim} ` &&
      inputValue !== ` ${inputValueTrim}` &&
      inputValue !== ` ${inputValueTrim} `
    ) {
      return;
    }

    let cachedData: Record<
      string,
      { data: [google.maps.places.AutocompletePrediction]; maxAge: number }
    > = {};

    const autocompleteList = e.target.parentElement.querySelector(
      `.${this.selectorListClass}`
    );

    const renderAutocompleteList = (
      predictions: [google.maps.places.AutocompletePrediction]
    ) => {
      this.hideAutocompleteList();
      autocompleteList.innerHTML = "";
      predictions.forEach((prediction, i) => {
        const itemText = document.createElement("span");
        itemText.setAttribute("class", "g-places-autocomplete-item-text");
        itemText.innerText = prediction.description;

        const item = document.createElement("li");
        item.setAttribute("data-place-id", prediction.place_id);
        item.setAttribute("class", this.selectorItemClass);
        item.setAttribute("data-index", `${i}`);
        item.addEventListener("click", this.handleSelectPlace);
        item.style.cursor = "pointer";
        item.appendChild(itemText);
        autocompleteList.appendChild(item);
      });
      this.showAutocompleteList();
    };

    try {
      cachedData = JSON.parse(sessionStorage.getItem(this.cacheKey) || "{}");
    } catch (error) {
      // Skip exception
    }

    if (this.cache) {
      cachedData = Object.keys(cachedData).reduce(
        (acc: typeof cachedData, key) => {
          if (cachedData[key].maxAge - Date.now() >= 0)
            acc[key] = cachedData[key];
          return acc;
        },
        {}
      );

      if (cachedData[inputValue]) {
        renderAutocompleteList(cachedData[inputValue].data);
        return;
      }
    }

    const autocompletionRequest = this.requestOptions;
    autocompletionRequest.input = inputValue;
    if (this.useSessionToken) {
      autocompletionRequest.sessionToken = this.sessionToken;
    }
    this.service.getPlacePredictions(
      autocompletionRequest,
      (
        predictions: [google.maps.places.AutocompletePrediction],
        status: google.maps.places.PlacesServiceStatus
      ) => {
        this.hideAutocompleteList();
        autocompleteList.innerHTML = "";
        if (status != google.maps.places.PlacesServiceStatus.OK) {
          console.warn(status);
          return;
        }
        if (this.cache) {
          cachedData[inputValue] = {
            data: predictions,
            maxAge: Date.now() + this.cache * 1000,
          };

          try {
            sessionStorage.setItem(this.cacheKey, JSON.stringify(cachedData));
          } catch (error) {
            // Skip exception
          }
        }
        renderAutocompleteList(predictions);
      }
    );
  };

  handleKeyDown = (e: any) => {
    if (!this.hasAutocompleteList) {
      return;
    }
    const maxIndex =
      this.autocompleteList.querySelectorAll(`.${this.selectorItemClass}`)
        .length - 1;
    const currentIndex = parseInt(
      this.autocompleteList
        .querySelector(`.${this.selectorItemClass}.active`)
        ?.getAttribute("data-index") || -1
    );

    let nextIndex;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = currentIndex < 0 ? maxIndex : currentIndex - 1;
      } else {
        nextIndex = currentIndex >= maxIndex ? -1 : currentIndex + 1;
      }
      if (nextIndex < 0) {
        e.target.value = this.autocompleteValue;
        this.updateState("");
        this.unsetIndex();
      } else {
        this.setIndex(nextIndex);
      }
    }

    if (e.key === "Escape") {
      this.hideAutocompleteList();
    } else if (e.key === "Enter") {
      if (currentIndex != -1) {
        this.hideAutocompleteList();
      } else {
        this.setIndex(0);
      }
    }
  };

  handleSelectPlace = (e: any) => {
    const li = e.target.classList.contains(this.selectorItemClass)
      ? e.target
      : e.target.parentElement;
    this.autocompleteInput.value = e.target.innerText;
    this.updateState(li.getAttribute("data-place-id"));
  };

  showAutocompleteList = () => {
    this.hasAutocompleteList = false;
    if (this.autocompleteList.innerText.trim() !== "") {
      this.autocompleteList.style.display = "inline-block";
      this.hasAutocompleteList = true;
    }
  };

  hideAutocompleteList = () => {
    this.autocompleteList.style.display = "none";
    this.hasAutocompleteList = false;
  };

  getSessionToken = () => {
    this.sessionToken = new google.maps.places.AutocompleteSessionToken();
    try {
      sessionStorage.setItem(
        this.useSessionTokenKey,
        JSON.stringify(this.sessionToken)
      );
    } catch (error) {
      // Skip exception
    }
    return this.sessionToken;
  };

  debounce = (fn: (...params: any[]) => any, n: number) => {
    let timer: number | undefined = undefined;
    return function (this: any, ...args: any[]) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), n);
      return timer;
    };
  };

  unsetIndex = () => {
    document
      .querySelectorAll(`.${this.selectorItemClass}.active`)
      .forEach((li: any) => {
        li.classList.remove("active");
      });
  };

  setIndex = (index: number) => {
    this.unsetIndex();
    const li = this.autocompleteList.querySelector(
      `.${this.selectorItemClass}[data-index="${index}"]`
    );
    if (li) {
      li.classList.add("active");
      this.autocompleteInput.value = li.innerText;
      this.updateState(li.getAttribute("data-place-id"));
    }
  };

  updateState = (placeId: string) => {
    if (placeId) {
      this.autocompleteInput.setAttribute("data-state", "done");
      this.autocompleteWrap.setAttribute("data-state", "done");
      this.autocompleteInput.setAttribute("data-place-id", placeId);
    } else {
      this.autocompleteInput.removeAttribute("data-place-id");
      this.autocompleteInput.removeAttribute("data-state");
      this.autocompleteWrap.removeAttribute("data-state");
    }
  };
}
