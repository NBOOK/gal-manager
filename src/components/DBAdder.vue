<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import GameEntry from "@/modules/GameEntry";
import GameImgThumb from "@/components/GameImgThumb.vue";
import utils from "@/modules/utils";

const gameStore = useGameStore();
const emit = defineEmits(["goBack", "proceed", "abort"]);
const props = defineProps<{ game: GameEntry }>();
const gameNameENCandidates = ref<VNTitle[]>([]);
const gameBrandENCandidates = ref<VNDeveloper[]>([]);
const allSteamCategories = ref<string[]>([]);
const allLutrisCategories = ref<string[]>([]);
const allHeroicCategories = ref<string[]>([]);
const isTitleMenuOpen = ref(false);
const isBrandMenuOpen = ref(false);
const selectedBrands = ref<VNDeveloper[]>([]);
const slugSync = ref(true);
const executables = ref<string[]>([]);
const executableIcons = ref<Record<string, string>>({});
const enTitleColor = ref("");
const enBrandColor = ref("");
const slugTitleColor = ref("");

const enTitleLoading = ref(true);
const executablesLoading = ref(true);
const dbAdding = ref(false);
const dbRemoving = ref(false);

const folderName = ref("");

function slugify(name: string, slug: string) {
  if (slugSync.value) {
    return utils.slugify(name);
  }
  return slug;
}

const titleKindColor = {
  title: "#f1f8e9",
  romanized: "#ffebee",
  releaseTitle: "#e1f5fe",
  alias: "#fff3e0",
  developer: "#f1f8e9",
  publisher: "#e1f5fe",
  stored: "#fff3e0",
  default: "#ede7f6",
};

const gameConfig = reactive<GameConfig>({
  gameName: "",
  gameBrand: "",
  gameNameEN: "",
  gameBrandEN: "",
  gameNameSlug: "",
  gameReleaseYear: "",
  steamCategories: [],
  heroicPrefix: "",
  heroicRunner: "",
  heroicCategories: [],
  lutrisPrefix: "",
  lutrisRunner: "",
  lutrisCategories: [],
  launcher: "",
  locale: "",
  controllerLayout: "avg.vdf",
  executable: "",
  platform: "",
});
const gameBrandFromFolder = computed(
  () => folderName.value.split(props.game.splitter)[0]
);
const gameNameFromFolder = computed(() =>
  folderName.value.split(props.game.splitter).slice(1).join(props.game.splitter)
);

async function getSetGameENCandidates() {
  enTitleLoading.value = true;
  const gameName = folderName.value
    .split(props.game.splitter)
    .slice(1)
    .join(props.game.splitter);
  const gameBrand = folderName.value.split(props.game.splitter)[0];
  const titlesAndBrands = await utils.getGameNameEN(gameName, gameBrand);
  gameNameENCandidates.value = titlesAndBrands.titles;
  gameBrandENCandidates.value = titlesAndBrands.brands;

  gameConfig.gameName = gameNameENCandidates.value[0].origTitle;
  gameConfig.gameNameEN = gameNameENCandidates.value[0].title;
  gameConfig.gameReleaseYear = gameNameENCandidates.value[0].year;
  enTitleColor.value = titleKindColor[gameNameENCandidates.value[0].kind];
  selectedBrands.value = [];
  selectedBrands.value.push(
    ...gameBrandENCandidates.value.filter((brand) => brand.kind === "developer")
  );
  if (selectedBrands.value.length === 0)
    selectedBrands.value.push(
      ...gameBrandENCandidates.value.filter(
        (brand) => brand.kind === "publisher"
      )
    );
  if (selectedBrands.value.length === 0)
    selectedBrands.value.push(gameBrandENCandidates.value[0]);
  slugTitleColor.value = enTitleColor.value;
  console.log("Set game EN candidates", gameNameENCandidates.value);

  enTitleLoading.value = false;
}

function checkFolderNameFormat() {
  if (!folderName.value) return "Folder name is empty.";
  if (!folderName.value.includes(props.game.splitter))
    return "Folder name must contain original splitter.";

  const gameBrand = folderName.value.split(props.game.splitter)[0];
  const gameName = folderName.value
    .split(props.game.splitter)
    .slice(1)
    .join(props.game.splitter);
  if (!gameBrand || !gameName)
    return "Folder name must contain a brand and a name.";
  return true;
}

function checkWindowsForbiddenChars() {
  const forbiddenChars = /[<>:"/\\|?*]/;
  if (forbiddenChars.test(folderName.value))
    return `Folder name contains forbidden characters: ${folderName.value.match(
      forbiddenChars
    )}`;
  if (folderName.value.endsWith(" ") || folderName.value.startsWith(" "))
    return "Folder name cannot start or end with a space.";
  if (folderName.value.endsWith("."))
    return "Folder name cannot end with a dot.";

  return true;
}

function updateGameName() {
  const gameBrand = folderName.value.split(props.game.splitter)[0];
  folderName.value = `${gameBrand}${props.game.splitter}${gameConfig.gameName}`;
}
function updateGameBrand() {
  const gameName = folderName.value
    .split(props.game.splitter)
    .slice(1)
    .join(props.game.splitter);
  folderName.value = `${gameConfig.gameBrand}${props.game.splitter}${gameName}`;
}

watch(
  () => gameConfig.gameBrandEN + gameConfig.gameNameEN,
  () => {
    gameConfig.gameNameSlug = slugify(
      `${gameConfig.gameBrandEN} - ${gameConfig.gameNameEN}`,
      gameConfig.gameNameSlug
    );
  }
);

watch(
  () => folderName.value,
  (newValue, oldValue) => {
    if (
      checkFolderNameFormat() !== true ||
      checkWindowsForbiddenChars() !== true
    )
      return;
    const oldBrand = oldValue.split(props.game.splitter)[0];
    const oldName = oldValue
      .split(props.game.splitter)
      .slice(1)
      .join(props.game.splitter);
    const newBrand = newValue.split(props.game.splitter)[0];
    const newName = newValue
      .split(props.game.splitter)
      .slice(1)
      .join(props.game.splitter);

    if (oldBrand !== newBrand) {
      // selectedBrands.value = [];
      gameConfig.gameBrand = newBrand;
    }
    if (oldName !== newName) gameConfig.gameName = newName;
  }
);

watch(
  () => selectedBrands.value,
  () => {
    console.log(selectedBrands.value);
    const sorted = selectedBrands.value.sort((a, b) => {
      if (a.kind === "developer" && b.kind === "publisher") return -1;
      if (a.kind === "publisher" && b.kind === "developer") return 1;
      return a.name.localeCompare(b.name);
    });
    gameConfig.gameBrandEN = sorted.map((brand) => brand.name).join("×");
    gameConfig.gameBrand = sorted.map((brand) => brand.origName).join("×");
    enBrandColor.value =
      titleKindColor[
        sorted.some((brand) => brand.kind === "developer")
          ? "developer"
          : sorted.some((brand) => brand.kind === "developer")
          ? "publisher"
          : props.game.inLutrisDB
          ? "stored"
          : "romanized"
      ];
  }
);

async function setUpTitles() {
  folderName.value = props.game.folderName;
  // handled by watching folderName later
  gameConfig.gameName = props.game.gameName;
  gameConfig.gameBrand = props.game.gameBrand;
  gameConfig.gameReleaseYear = props.game.gameReleaseYear;

  if (props.game.inDatabase) {
    gameConfig.gameNameEN = props.game.gameNameEN;
    enTitleColor.value = titleKindColor.stored;
    selectedBrands.value.push({
      id: "",
      name: props.game.gameBrandEN,
      origName: props.game.gameBrand,
      kind: "stored",
    });
    enBrandColor.value = titleKindColor.stored;
    gameConfig.gameNameSlug = props.game.gameNameSlug;
    slugTitleColor.value = titleKindColor.stored;

    const titlesAndBrands = await utils.getGameNameEN(
      gameConfig.gameName,
      gameConfig.gameBrand
    );
    gameNameENCandidates.value = titlesAndBrands.titles;
    gameBrandENCandidates.value = titlesAndBrands.brands;
  } else {
    await getSetGameENCandidates();
  }

  enTitleLoading.value = false;
}

async function setUpExcutables() {
  // scan executables
  const gamePath = `${props.game.basePath}/${props.game.folderName}`;
  const scannedFiles: DirEntry[] = await window.ipcRenderer.invoke(
    "scanDir",
    gamePath
  );
  const filteredFiles: DirEntry[] = [];
  for (const file of scannedFiles) {
    if (
      file.isFile &&
      (file.name.toLowerCase().endsWith(".exe") ||
        file.name.toLowerCase().endsWith(".bat") ||
        file.name.toLowerCase().endsWith(".sh") ||
        file.name.toLowerCase().endsWith(".appimage") ||
        (await window.ipcRenderer.invoke(
          "hasExecutableMagic",
          `${gamePath}/${file.name}`
        )))
    ) {
      filteredFiles.push(file);
    }
  }
  executables.value = filteredFiles.map((file: DirEntry) => file.name);
  await getExecutableIcons();
  executables.value = await utils.guessLauncher(executables.value);
  if (props.game.inLutrisDB) {
    gameConfig.executable = gameStore.lutrisDB
      .getPerGameConfig(props.game)
      .game.exe.split("/")
      .pop();
  } else {
    gameConfig.executable = executables.value[0];
  }
  executablesLoading.value = false;
}

async function setupEnv() {
  // setup categories, prefix, runner, locale, launcher
  const heroicPergameConfig = gameStore.heroicDB.getPerGameConfig(props.game);
  const lutrisPergameConfig = gameStore.lutrisDB.getPerGameConfig(props.game);

  // heroic prefix
  gameConfig.heroicPrefix = props.game.heroicPrefix; // either already set or "", will set below
  if (!gameConfig.heroicPrefix) {
    if (
      gameStore.heroicDB.winePrefixes.includes(
        gameStore.config.value.heroic.defaultWinePrefix
      )
    ) {
      gameConfig.heroicPrefix = gameStore.config.value.heroic.defaultWinePrefix;
    } else {
      gameConfig.heroicPrefix = gameStore.heroicDB.winePrefixes[0];
    }
  }

  // heroic runner
  gameConfig.heroicRunner = props.game.heroicRunner; // either already set or "", will set below
  if (!gameConfig.heroicRunner) {
    if (
      gameStore.heroicDB.wineRunners.includes(
        gameStore.config.value.heroic.defaultWineRunner
      )
    )
      gameConfig.heroicRunner = gameStore.config.value.heroic.defaultWineRunner;
    else {
      gameConfig.heroicRunner = gameStore.heroicDB.wineRunners[0];
    }
  }

  // heroic categories
  allHeroicCategories.value = Object.keys(
    gameStore.heroicDB.heroicCategories
  ).sort();
  if (props.game.inHeroicDB) {
    gameConfig.heroicCategories = await gameStore.heroicDB.categoriesForGame(
      props.game
    );
  } else {
    gameConfig.heroicCategories.length = 0;
    gameConfig.heroicCategories.push("Gal");
  }

  // lutris prefix
  gameConfig.lutrisPrefix = props.game.lutrisPrefix; // either already set or "", will set below
  if (!gameConfig.lutrisPrefix) {
    if (
      gameStore.lutrisDB.winePrefixes.includes(
        gameStore.config.value.lutris.defaultWinePrefix
      )
    ) {
      gameConfig.lutrisPrefix = gameStore.config.value.lutris.defaultWinePrefix;
    } else {
      gameConfig.lutrisPrefix = gameStore.lutrisDB.winePrefixes[0];
    }
  }

  // lutris runner
  gameConfig.lutrisRunner = props.game.lutrisRunner; // either already set or "", will set below
  if (!gameConfig.lutrisRunner) {
    if (
      gameStore.lutrisDB.wineRunners.includes(
        gameStore.config.value.lutrisDefaultWineRunner
      )
    )
      gameConfig.lutrisRunner = gameStore.config.value.lutrisDefaultWineRunner;
    else {
      gameConfig.lutrisRunner = gameStore.lutrisDB.wineRunners[0];
    }
  }

  // lutris categories
  allLutrisCategories.value = Object.keys(
    gameStore.lutrisDB.lutrisCategories
  ).sort();
  if (props.game.inLutrisDB) {
    gameConfig.lutrisCategories = await gameStore.lutrisDB.categoriesForGame(
      props.game
    );
  } else {
    gameConfig.lutrisCategories.length = 0;
    gameConfig.lutrisCategories.push("Gal");
  }

  // Steam categories
  allSteamCategories.value = gameStore.steamDB.steamCategoriesNames.sort();
  if (props.game.inSteamDB) {
    gameConfig.steamCategories = gameStore.steamDB.categoriesForGame(
      props.game
    );
  } else {
    gameConfig.steamCategories.length = 0;
    gameConfig.steamCategories.push("Gal");
  }

  // locale, use lutris first
  gameConfig.locale = lutrisPergameConfig.system?.locale;
  if (!gameConfig.locale) {
    // then heroic
    heroicPergameConfig.environmentOptions?.forEach((option: any) => {
      if (option.key === "LANG") gameConfig.locale = option.value;
    });
  }
  if (!gameConfig.locale) {
    // then global config
    gameConfig.locale = gameStore.config.value.defaultLocale;
  }

  // launcher
  gameConfig.launcher = props.game.launcher; // either already set or "", will set below
  if (!gameConfig.launcher || gameConfig.launcher === "Unknown") {
    gameConfig.launcher = "Heroic";
  }
}

function reset() {
  enTitleLoading.value = true;
  gameNameENCandidates.value = [];
  gameBrandENCandidates.value = [];
  allSteamCategories.value = [];
  allLutrisCategories.value = [];
  isTitleMenuOpen.value = false;
  isBrandMenuOpen.value = false;
  slugSync.value = true;
  executables.value = [];
  executableIcons.value = {};
  enTitleColor.value = "";
  enBrandColor.value = "";
  slugTitleColor.value = "";
  executablesLoading.value = true;
  dbAdding.value = false;
  dbRemoving.value = false;
  folderName.value = "";
  selectedBrands.value = [];
}

watch(
  () => props.game,
  async () => {
    reset();
    Promise.all([setUpTitles(), setUpExcutables(), setupEnv()]);
  },
  { immediate: true }
);

async function addGameToDB() {
  dbAdding.value = true;

  gameConfig.gameBrand = folderName.value.split(props.game.splitter)[0];
  gameConfig.gameName = folderName.value
    .split(props.game.splitter)
    .slice(1)
    .join(props.game.splitter);

  if (
    gameConfig.executable.endsWith(".exe") ||
    gameConfig.executable.endsWith(".bat")
  ) {
    gameConfig.platform = "Windows";
  } else {
    gameConfig.platform = "Linux";
  }

  console.log("Adding...", gameConfig);
  const nameChanged = folderName.value !== props.game.folderName;

  if (props.game.inDatabase > 0) {
    console.log("Game already in database! Removing it...");
    // set reAdd to true if the game name is not changed
    // so the controller config will not be removed
    await props.game.removeDB(!nameChanged);
  }
  if (nameChanged) {
    console.log("Game name changed! Updating it...");
    await props.game.rename(folderName.value);
  }
  props.game.gameReleaseYear = gameConfig.gameReleaseYear;
  await props.game.addDB(gameConfig);
  dbAdding.value = false;
  emit("proceed");
}

async function removeGameFromDB() {
  dbRemoving.value = true;
  await props.game.removeDB();
  dbRemoving.value = false;
  emit("proceed");
}

async function getExecutableIcons() {
  const iconPromises = executables.value.map(async (executable) => {
    const exePath = `${props.game.basePath}/${props.game.folderName}/${executable}`;
    if (exePath.endsWith(".bat")) return;
    const iconBase64 = await window.ipcRenderer.invoke("getFileIcon", exePath);
    if (iconBase64.length > 0) {
      executableIcons.value[executable] = iconBase64[0];
    }
  });
  await Promise.all(iconPromises);
}

async function openVNDBLink(id: string) {
  window.ipcRenderer.invoke("openExternal", `https://vndb.org/${id}`);
}
</script>

<template>
  <v-carousel-item>
    <v-card rounded="lg" height="100%" class="pa-0 d-flex flex-column">
      <v-list class="ma-0 pa-8 flex-grow-1">
        <div class="mb-5 d-flex flex-row align-start justify-space-between">
          <div class="flex-grow-1">
            <!-- ------------------------- Orig Title ------------------------------- -->
            <v-row class="flex-grow-0 mb-5">
              <v-text-field
                density="compact"
                label="Folder Name"
                variant="outlined"
                clearable
                clear-icon="$mdiBackspaceOutline"
                placeholder="Game's orginal title."
                prepend-icon="$mdiFolder"
                :spellcheck="false"
                :rules="[checkFolderNameFormat, checkWindowsForbiddenChars]"
                :hint="
                  gameConfig.gameBrand + game.splitter + gameConfig.gameName ===
                  folderName
                    ? ''
                    : gameConfig.gameBrand + game.splitter + gameConfig.gameName
                "
                persistent-hint
                v-model="folderName"
                class="vn-title-textinput"
              >
                <template #append-inner>
                  <v-btn
                    v-if="folderName !== game.folderName"
                    density="compact"
                    variant="plain"
                    icon="$mdiReload"
                    @click="folderName = game.folderName"
                    style="margin-left: -2px"
                  />
                  <v-btn
                    density="compact"
                    variant="plain"
                    icon="$mdiSearchWeb"
                    @click="async () => getSetGameENCandidates()"
                    :style="`margin-right: -${
                      folderName !== game.folderName ? 2 : 4
                    }px`"
                  />
                </template>
              </v-text-field>
            </v-row>

            <!-- ------------------------- Eng Title ------------------------------- -->
            <v-row class="flex-grow-0 mb-5">
              <v-text-field
                density="compact"
                label="EN Title"
                variant="outlined"
                clearable
                clear-icon="$mdiBackspaceOutline"
                placeholder="Game's English/romanized title."
                prepend-icon="$mdiTranslate"
                :spellcheck="false"
                :loading="enTitleLoading"
                v-model="gameConfig.gameNameEN"
                :bg-color="gameConfig.gameNameEN ? enTitleColor : ''"
                :hint="gameConfig.gameName"
                persistent-hint
                @input="
                  () => {
                    enTitleColor = '';
                    slugTitleColor = '';
                    isTitleMenuOpen = false;
                  }
                "
                @click:clear="
                  () => {
                    gameConfig.gameNameEN = '';
                  }
                "
                :rules="[
                  () =>
                    gameConfig.gameNameEN.length !== 0 ||
                    'English title is empty.',
                ]"
                class="vn-title-textinput"
              >
                <template #append-inner>
                  <v-btn
                    v-if="gameNameFromFolder !== gameConfig.gameName"
                    density="compact"
                    variant="plain"
                    icon="$mdiArrowUpRight"
                    @click.stop="updateGameName"
                  />
                  <v-icon
                    style="cursor: pointer"
                    :class="{ 'rotate-icon': isTitleMenuOpen }"
                    icon="$mdiMenuDown"
                  />
                </template>
                <v-menu
                  activator="parent"
                  location="bottom center"
                  origin="top center"
                  max-height="300"
                  v-model="isTitleMenuOpen"
                  transition="slide-y-transition"
                >
                  <v-list color="primary" style="width: 100%">
                    <v-list-item
                      v-for="item in gameNameENCandidates"
                      :border="true"
                      :key="item.title"
                      :value="item.title"
                      :title="item.title"
                      :subtitle="item.origTitle"
                      :class="'vn-title-kind-' + item.kind"
                      @click="
                        () => {
                          gameConfig.gameNameEN = item.title;
                          gameConfig.gameName = item.origTitle;
                          gameConfig.gameReleaseYear = item.year;
                          enTitleColor = titleKindColor[item.kind];
                          slugTitleColor = '';
                        }
                      "
                    >
                      <template #prepend>
                        <v-btn
                          variant="plain"
                          density="compact"
                          :icon="item.id ? '$mdiSearchWeb' : ''"
                          :readonly="item.id === ''"
                          @click.stop="openVNDBLink(item.id)"
                          style="margin: 0 4px 0 -8px"
                        />
                      </template>
                      <template #append>
                        <v-progress-circular
                          :model-value="item.weight"
                          :width="3"
                          size="24"
                          color="grey-darken-4"
                        />
                      </template>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </v-text-field>
            </v-row>

            <!-- ------------------------- Eng BrandName ------------------------------- -->
            <v-row class="flex-grow-0 mb-4">
              <v-text-field
                density="compact"
                label="EN Brand Name"
                variant="outlined"
                clearable
                clear-icon="$mdiBackspaceOutline"
                placeholder="Game's English/romanized title."
                prepend-icon="$mdiDomain"
                :spellcheck="false"
                :loading="enTitleLoading"
                v-model="gameConfig.gameBrandEN"
                :bg-color="gameConfig.gameBrandEN ? enBrandColor : ''"
                :hint="gameConfig.gameBrand"
                persistent-hint
                @input="
                  () => {
                    enBrandColor = '';
                    slugTitleColor = '';
                    isBrandMenuOpen = false;
                  }
                "
                @click:clear="
                  () => {
                    selectedBrands = [];
                    enBrandColor = '';
                  }
                "
                :rules="[
                  () =>
                    gameConfig.gameBrandEN.length !== 0 ||
                    'English brand name is empty.',
                ]"
                class="vn-title-textinput"
              >
                <template #append-inner>
                  <v-btn
                    v-if="gameBrandFromFolder !== gameConfig.gameBrand"
                    density="compact"
                    variant="plain"
                    icon="$mdiArrowUpRight"
                    @click.stop="updateGameBrand"
                  />
                  <v-icon
                    style="cursor: pointer"
                    :class="{ 'rotate-icon': isBrandMenuOpen }"
                    icon="$mdiMenuDown"
                  />
                </template>
                <v-menu
                  activator="parent"
                  location="bottom center"
                  origin="top center"
                  max-height="300"
                  v-model="isBrandMenuOpen"
                  :close-on-content-click="false"
                  transition="slide-y-transition"
                >
                  <v-list
                    color="primary"
                    select-strategy="leaf"
                    v-model:selected="selectedBrands"
                    mandatory
                    style="width: 100%"
                  >
                    <v-list-item
                      v-for="item in gameBrandENCandidates"
                      :border="true"
                      :key="item.name"
                      :value="item"
                      :title="item.name"
                      :subtitle="item.origName"
                      :class="'vn-title-kind-' + item.kind"
                      @click="
                        () => {
                          // if (!selectedBrands.includes(item)) {
                          //   selectedBrands.push(item);
                          // }
                          slugTitleColor = '';
                        }
                      "
                    >
                      <template #prepend>
                        <v-btn
                          variant="plain"
                          density="compact"
                          :icon="item.id ? '$mdiSearchWeb' : ''"
                          :readonly="item.id === ''"
                          @click.stop="openVNDBLink(item.id)"
                          style="margin: 0 4px 0 -8px"
                        />
                      </template>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </v-text-field>

              <!---------------------- Release Year --------------------->
              <v-text-field
                density="compact"
                label="Release Year"
                variant="outlined"
                clearable
                clear-icon="$mdiBackspaceOutline"
                placeholder="Year"
                prepend-icon="$mdiCalendarMonthOutline"
                :spellcheck="false"
                :loading="enTitleLoading"
                v-model="gameConfig.gameReleaseYear"
                :bg-color="gameConfig.gameBrandEN ? enTitleColor : ''"
                class="flex-grow-0"
                style="width: 145px; height: 40px; margin-left: 20px"
              ></v-text-field>
            </v-row>

            <!-- ------------------------- Slug Title ------------------------------- -->
            <v-row class="flex-grow-0 mb-0">
              <v-text-field
                density="compact"
                label="Slug"
                variant="outlined"
                clearable
                clear-icon="$mdiBackspaceOutline"
                placeholder="Game's title slug (identifier)."
                prepend-icon="$mdiFingerprint"
                :spellcheck="false"
                v-model="gameConfig.gameNameSlug"
                :bg-color="gameConfig.gameNameSlug ? slugTitleColor : ''"
                @input="
                  () => {
                    slugTitleColor = '';
                    slugSync = false;
                  }
                "
                :rules="[
                  () =>
                    gameConfig.gameNameSlug.length !== 0 ||
                    'Game slug is empty.',
                ]"
                @click:clear="gameConfig.gameNameSlug = ''"
                s
                class="vn-title-textinput"
              >
                <template #append-inner>
                  <v-btn
                    density="compact"
                    variant="plain"
                    :icon="slugSync ? '$mdiAutorenew' : '$mdiSyncOff'"
                    @click="slugSync = !slugSync"
                  />
                </template>
              </v-text-field>
            </v-row>
          </div>
          <v-img
            :src="`file://${game.imageAssets.paths.capsuleSD}`"
            width="178"
            :aspect-ratio="2 / 3"
            class="flex-grow-0"
            rounded
            style="margin: -12px -12px 0 32px; cursor: pointer"
          >
            <GameImgThumb :game="game" />
          </v-img>
        </div>

        <!-- Heroic & Layout -->
        <v-row class="flex-grow-0 flex-nowrap">
          <v-select
            label="Heroic Prefix"
            density="compact"
            :items="gameStore.heroicDB.winePrefixes"
            v-model="gameConfig.heroicPrefix"
            variant="outlined"
            prepend-icon="$mdiPackageVariantClosed"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: calc(50% - 108px) !important"
          />

          <div style="width: 20px"></div>

          <v-select
            label="Heroic Runner"
            density="compact"
            :items="gameStore.heroicDB.wineRunners"
            v-model="gameConfig.heroicRunner"
            variant="outlined"
            prepend-icon="$customWineEmptyVariant"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: calc(50% - 108px)"
          />

          <div style="width: 20px"></div>

          <v-select
            label="Layout"
            density="compact"
            :items="gameStore.steamDB.controllerLayouts"
            v-model="gameConfig.controllerLayout"
            variant="outlined"
            prepend-icon="$mdiController"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: 178px"
          />
        </v-row>

        <!-- Lutris & Locale -->
        <v-row class="flex-grow-0 flex-nowrap">
          <v-select
            label="Lutris Prefix"
            density="compact"
            :items="gameStore.lutrisDB.winePrefixes"
            v-model="gameConfig.lutrisPrefix"
            variant="outlined"
            prepend-icon="$mdiPackageVariantClosed"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: calc(50% - 108px) !important"
          />

          <div style="width: 20px"></div>

          <v-select
            label="Lutris Runner"
            density="compact"
            :items="gameStore.lutrisDB.wineRunners"
            v-model="gameConfig.lutrisRunner"
            variant="outlined"
            prepend-icon="$customWineEmptyVariant"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: calc(50% - 108px)"
          />

          <div style="width: 20px"></div>

          <v-select
            label="Locale"
            density="compact"
            :items="['ja_JP.utf8', 'zh_CN.utf8', 'zh_HK.utf8', 'en_US.utf8']"
            v-model="gameConfig.locale"
            :item-title="(item) => item.slice(3, -5)"
            :item-value="(item) => item"
            variant="outlined"
            prepend-icon="$mdiWeb"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: 178px"
          >
            <template #prepend-inner>
              <img :src="`icons/${gameConfig.locale}.svg`" />
            </template>
            <template #item="{ props, item }">
              <v-list-item v-bind="props" :title="item.raw.slice(3, -5)">
                <template #prepend>
                  <img :src="`icons/${item.raw}.svg`" class="mr-3" />
                </template>
              </v-list-item>
            </template>
          </v-select>
        </v-row>

        <!-- Categories & Launcher -->
        <v-row class="flex-grow-0 flex-nowrap">
          <v-select
            label="Steam Categories"
            density="compact"
            clearable
            chips
            closable-chips
            hide-selected
            multiple
            :items="allSteamCategories"
            v-model="gameConfig.steamCategories"
            variant="outlined"
            prepend-icon="$mdiSteam"
            clear-icon="$mdiBackspaceOutline"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: calc((100% - 238px) / 3)"
          />

          <div style="width: 20px"></div>

          <v-select
            label="Heroic Categories"
            density="compact"
            clearable
            chips
            closable-chips
            hide-selected
            multiple
            :items="allHeroicCategories"
            v-model="gameConfig.heroicCategories"
            variant="outlined"
            prepend-icon="$mdiTagMultiple"
            clear-icon="$mdiBackspaceOutline"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: calc((100% - 238px) / 3)"
          />

          <div style="width: 20px"></div>

          <v-select
            label="Lutris Categories"
            density="compact"
            clearable
            chips
            closable-chips
            hide-selected
            multiple
            :items="allLutrisCategories"
            v-model="gameConfig.lutrisCategories"
            variant="outlined"
            prepend-icon="$mdiTagMultiple"
            clear-icon="$mdiBackspaceOutline"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: calc((100% - 238px) / 3)"
          />

          <div style="width: 20px"></div>

          <v-select
            label="Launcher"
            density="compact"
            :items="['Heroic', 'Lutris']"
            v-model="gameConfig.launcher"
            variant="outlined"
            prepend-icon="$mdiLayers"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: 178px"
          >
            <template #prepend-inner>
              <img
                :src="`icons/${gameConfig.launcher}.svg`"
                style="width: 24px; height: 24px"
              />
            </template>
            <template #item="{ props, item }">
              <v-list-item v-bind="props" :title="item.raw">
                <template #prepend>
                  <img
                    :src="`icons/${item.raw}.svg`"
                    style="width: 24px; height: 24px"
                  />
                </template>
              </v-list-item>
            </template>
          </v-select>
        </v-row>

        <!-- ------------------------- Executable Selection ------------------------------- -->
        <v-row>
          <v-icon
            icon="$mdiOpenInApp"
            size="20"
            style="height: 20px; margin: 12px 18px 0 2px; color: #676767"
          />
          <v-sheet
            :border="true"
            style="
              width: calc(100% - 40px);
              border-color: #afafaf;
              border-radius: 5px;
              min-height: 78px;
            "
            class="d-flex flex-column justify-start"
          >
            <div
              style="
                position: relative;
                top: -10px; /* 让文本浮在边框线上 */
                left: 10px;
                background: white; /* 避免和边框重叠 */
                padding: 0 5px;
                margin-bottom: -10px;
                font-size: 12px;
                color: #888888;
                width: max-content;
              "
            >
              Executable
            </div>
            <v-item-group
              v-model="gameConfig.executable"
              mandatory
              class="d-flex flex-row flex-wrap my-1"
            >
              <v-item
                v-for="item in executables"
                :key="item"
                :value="item"
                v-slot="{ isSelected, toggle }"
              >
                <v-card
                  :color="isSelected ? 'blue-lighten-4' : ''"
                  @click="toggle"
                  class="d-flex flex-column justify-start align-center mx-1"
                  style="height: 60px; width: 60px"
                  flat
                  :ripple="false"
                >
                  <v-img
                    v-if="executableIcons[item]"
                    :src="executableIcons[item]"
                    style="height: 30px; width: 30px; flex-grow: 0"
                  />
                  <v-icon
                    v-else
                    :icon="
                      item.endsWith('.exe')
                        ? '$mdiApplicationOutline'
                        : item.endsWith('.bat') || item.endsWith('.sh')
                        ? '$mdiConsole'
                        : '$mdiFileOutline'
                    "
                    color="grey-darken-2"
                    style="height: 30px; width: 30px; flex-grow: 0"
                  />
                  <div
                    class="text-center"
                    style="font-size: 10px; max-width: 100%"
                  >
                    {{ item }}
                  </div>
                  <v-tooltip
                    activator="parent"
                    location="top"
                    open-delay="1000"
                    transition="fade-transition"
                  >
                    {{ item }}
                  </v-tooltip>
                </v-card>
              </v-item>
            </v-item-group>
          </v-sheet>
        </v-row>
      </v-list>

      <!-- ------------------------- Bottom Nav Btns ------------------------------- -->
      <v-row
        class="align-self-end align-end pr-8 pb-8 mt-5 flex-grow-0 flex-nowrap"
      >
        <v-hover>
          <template v-slot:default="{ isHovering, props }">
            <v-btn
              v-bind="props"
              :prepend-icon="isHovering ? '$mdiDeleteEmpty' : '$mdiDelete'"
              variant="outlined"
              :color="isHovering ? 'red' : 'grey-darken-4'"
              class="ml-2"
              :disabled="game.inDatabase === 0 || dbAdding"
              :loading="dbRemoving"
              @click="removeGameFromDB"
            >
              Remove
            </v-btn>
          </template>
        </v-hover>

        <v-btn
          prepend-icon="$mdiStop"
          variant="outlined"
          color="grey-darken-4"
          class="ml-2"
          :disabled="dbAdding || dbRemoving"
          @click="$emit('abort')"
          >Stop</v-btn
        >

        <v-btn
          prepend-icon="$mdiSkipPrevious"
          variant="outlined"
          color="grey-darken-4"
          class="ml-2"
          :disabled="dbAdding || dbRemoving"
          @click="$emit('goBack')"
          >Prev</v-btn
        >

        <v-btn
          prepend-icon="$mdiSkipNext"
          variant="outlined"
          color="grey-darken-4"
          class="ml-2"
          :disabled="dbAdding || dbRemoving"
          @click="$emit('proceed')"
          >Next</v-btn
        >
        <v-btn
          prepend-icon="$mdiDatabaseEdit"
          variant="outlined"
          color="green"
          class="ml-2"
          :disabled="
            dbRemoving ||
            checkFolderNameFormat() !== true ||
            checkWindowsForbiddenChars() !== true ||
            gameConfig.gameNameEN.length === 0 ||
            gameConfig.gameBrandEN.length === 0 ||
            gameConfig.gameNameSlug.length === 0
          "
          :loading="dbAdding"
          @click="addGameToDB"
          >Add to Database</v-btn
        >
      </v-row>
    </v-card>
  </v-carousel-item>
</template>

<style scoped>
.vn-title-kind-title {
  background-color: #f1f8e9 !important;
}
.vn-title-kind-romanized {
  background-color: #ffebee !important;
}
.vn-title-kind-releaseTitle {
  background-color: #e1f5fe !important;
}
.vn-title-kind-alias {
  background-color: #fff3e0 !important;
}
.vn-title-kind-developer {
  background-color: #f1f8e9 !important;
}
.vn-title-kind-publisher {
  background-color: #e1f5fe !important;
}

.rotate-icon {
  transform: rotate(180deg);
}

.v-icon {
  transition: transform 0.3s ease;
}

::-webkit-scrollbar {
  display: none;
}
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: #f0f0f0;
}
::-webkit-scrollbar-track:hover {
  background: #f0f0f0;
}

::-webkit-scrollbar-thumb {
  background-color: #cccccc;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: #888888;
}

.lutris-config-spacer {
  width: 100%;
  max-width: 24px;
  min-width: 0px;
  flex-shrink: 1.32;
}

.v-list-item-title {
  font-size: 14px;
}

.lutris-subheader.v-list-subheader {
  height: 24px !important;
  min-height: 10px !important;
  font-size: 12px !important;
  padding-left: 0px !important;
}

.lutris-item.v-list-item {
  min-height: 10px !important;
  height: 24px !important;
}

.lutris-item.v-list-item .v-list-item-title {
  font-size: 12px !important;
}
.vn-title-textinput :deep(.v-chip__close) {
  margin-inline-start: -15px !important;
}

.vn-title-textinput :deep(.v-input__details) {
  min-height: 0px !important;
  padding-top: 3px !important;
  /* height: 100px !important; */
}
</style>
