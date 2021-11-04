/* eslint-disable @typescript-eslint/no-explicit-any */
class GPlacesAutocomplete {
  service: any;
  sessionToken: any;

  cache = 24 * 60 * 60;
  cacheKey = "GPlacesAutocomplete";
  debug = false;
  delay = 300;
  minChar = 1;
  requestOptions: any = {};
  showMyLocation = false;
  showMyLocationText = "My Location";
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
  selectorItemTextClass = "g-places-autocomplete-item-text";
  selectorInput = ".g-places-autocomplete";

  hasAutocompleteList = false;

  constructor(
    options: {
      cache?: number;
      debug?: boolean;
      delay?: number;
      minChar?: number;
      requestOptions?: any;
      selector?: string;
      showMyLocation?: boolean;
      showMyLocationText?: string;
      trimValue?: boolean;
      useSessionToken?: boolean;
    } = {}
  ) {
    this.cache = options?.cache ?? this.cache;
    this.debug = options?.debug ?? this.debug;
    this.delay = options?.delay ?? this.delay;
    this.minChar = options?.minChar ?? this.minChar;
    this.requestOptions = options?.requestOptions ?? this.requestOptions;
    this.selectorInput = options?.selector ?? this.selectorInput;
    this.showMyLocation = options?.showMyLocation ?? this.showMyLocation;
    this.showMyLocationText =
      options?.showMyLocationText ?? this.showMyLocationText;
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

      this.showMyLocation && ul.appendChild(this.getMyLocationItem());

      parent.appendChild(ul);
      parent.style.position = "relative";
      input.addEventListener("focus", this.handleFocus);
      input.addEventListener("click", this.handleClick);
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
    this.handleClick(e);
    this.autocompleteInput.select();
  };

  handleClick = (e: any) => {
    this.autocompleteWrap = e.target.parentElement;
    this.autocompleteList = this.autocompleteWrap.querySelector(
      `.${this.selectorListClass}`
    );
    this.autocompleteInput = e.target;
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
      this.showMyLocation &&
        autocompleteList.appendChild(this.getMyLocationItem());
      predictions.forEach((prediction, i) => {
        const itemText = document.createElement("span");
        itemText.setAttribute("class", this.showMyLocationText);
        itemText.innerText = prediction.description;

        const item = document.createElement("li");
        item.setAttribute("data-place-id", prediction.place_id);
        item.setAttribute("class", this.selectorItemClass);
        item.setAttribute("data-index", `${this.showMyLocation ? i + 1 : i}`);
        item.addEventListener("click", this.handleSelectPlace);
        item.style.cursor = "pointer";
        item.appendChild(itemText);
        autocompleteList.appendChild(item);
      });
      const item = document.createElement("li");
      item.setAttribute("class", "powered-by-google");
      const image = document.createElement("img");
      image.setAttribute("alt", "Powered by Google");
      image.setAttribute(
        "src",
        "https://g-places-autocomplete.pages.dev/images/powered-by-google-on-white.png"
      );
      item.appendChild(image);
      autocompleteList.appendChild(item);
      this.showAutocompleteList();
    };

    try {
      cachedData = JSON.parse(sessionStorage.getItem(this.cacheKey) || "{}");
    } catch (error) {
      console.log(error);
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
          } catch (err) {
            console.log(err);
          }
        }
        renderAutocompleteList(predictions);
      }
    );

    if (this.debug) {
      let count = 0;
      try {
        const debug = JSON.parse(
          localStorage.getItem("debug") || "{countGetPlacePredictions:0}"
        );
        count = debug.countGetPlacePredictions;
      } catch (err) {
        console.log(err);
      }
      count++;
      try {
        localStorage.setItem(
          "debug",
          JSON.stringify({
            countGetPlacePredictions: count,
          })
        );
      } catch (err) {
        console.log(err);
      }
      console.info(count);
    }
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
    } catch (err) {
      console.log(err);
    }
    return this.sessionToken;
  };

  debounce = (fn: (...params: any[]) => any, n: number) => {
    let timer: any;
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

  getMyLocationItem = () => {
    const itemText = document.createElement("span");
    itemText.setAttribute("class", this.selectorItemTextClass);
    itemText.innerText = this.showMyLocationText;

    const item = document.createElement("li");
    item.setAttribute("data-place-id", "MyLocation");
    item.setAttribute("class", `${this.selectorItemClass} my-location`);
    item.setAttribute("data-index", `0`);
    item.addEventListener("click", this.handleSelectMyLocationItem);
    item.style.cursor = "pointer";
    item.appendChild(itemText);
    return item;
  };

  handleSelectMyLocationItem = (e: any) => {
    this.getCurrentPosition()
      .then((position) => {
        console.log(position);
      })
      .catch((err) => {
        console.log(err);
      });
    this.handleSelectPlace(e);
  };

  getCurrentPosition = () => {
    if (navigator.geolocation) {
      return new Promise(
        (
          resolve: PositionCallback,
          reject: PositionErrorCallback | null | undefined
        ) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            maximumAge: 0
          })
      );
    } else {
      return new Promise((resolve) => resolve({}));
    }
  };
}
