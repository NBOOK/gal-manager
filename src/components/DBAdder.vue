<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted } from "vue";
import { useGameStore } from "@/store/global-store";
import GameEntry from "@/modules/GameEntry";
import utils from "@/modules/utils";

const gameStore = useGameStore();
const emit = defineEmits(["proceed", "abort"]);
const props = defineProps<{ game: GameEntry }>();
const game = computed(() => props.game);
const gameNameENCandidates = ref<VNTitle[]>([]);
const gameBrandENCandidates = ref<VNDeveloper[]>([]);
const allSteamCategories = ref<string[]>([]);
const allLutrisCategories = ref<string[]>([]);
const isTitleMenuOpen = ref(false);
const isBrandMenuOpen = ref(false);
const selectedBrands = ref<VNDeveloper[]>([]);
const slugSync = ref(true);
const executables = ref<string[]>([]);
const enTitleColor = ref("");
const enBrandColor = ref("");
const slugTitleColor = ref("");

const enTitleLoading = ref(true);
const executablesLoading = ref(true);
const dbAdding = ref(false);
const dbRemoving = ref(false);

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
  winePrefix: "",
  wineRunner: "",
  executable: "",
  locale: "",
  controllerLayout: "avg.vdf",
  steamCategories: [],
  lutrisCategories: [],
});
const folderName = ref("");
const gameBrandFromFolder = computed(
  () => folderName.value.split(props.game.splitter)[0]
);
const gameNameFromFolder = computed(() =>
  folderName.value.split(props.game.splitter).slice(1).join(props.game.splitter)
);

async function getGameENCandidates() {
  const gameName = gameConfig.gameName;
  const gameBrnad = gameConfig.gameBrand;
  enTitleLoading.value = true;
  const titlesAndBrands = await utils.getGameNameEN(gameName, gameBrnad);
  gameNameENCandidates.value = titlesAndBrands.titles;
  gameBrandENCandidates.value = titlesAndBrands.brands;
  enTitleLoading.value = false;
}

function checkFolderNameFormat() {
  if (!folderName.value) return "Folder name is empty.";
  if (!folderName.value.includes(props.game.splitter))
    return "Folder name must contain a splitter.";

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
    return "Folder name contains forbidden characters.";
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
      gameConfig.gameBrandEN + gameConfig.gameNameEN,
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
  () => selectedBrands.value.length,
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
          : "publisher"
      ];
  }
);

onMounted(async () => {
  folderName.value = props.game.folderName;
  // handled by watching folderName later
  gameConfig.gameName = props.game.gameName;
  gameConfig.gameBrand = props.game.gameBrand;

  await getGameENCandidates();

  if (props.game.inDatabase) {
    gameConfig.gameNameEN = props.game.gameNameEN;
    enTitleColor.value = titleKindColor.stored;
    gameConfig.gameBrandEN = props.game.gameBrandEN;
    enBrandColor.value = titleKindColor.stored;
    gameConfig.gameNameSlug = props.game.gameNameSlug;
    slugTitleColor.value = titleKindColor.stored;
  } else {
    gameConfig.gameName = gameNameENCandidates.value[0].origTitle;
    gameConfig.gameNameEN = gameNameENCandidates.value[0].title;
    enTitleColor.value = titleKindColor[gameNameENCandidates.value[0].kind];
    // gameConfig.gameBrand = gameBrandENCandidates.value[0].origName;
    // gameConfig.gameBrandEN = gameBrandENCandidates.value[0].name;
    // enBrandColor.value = titleKindColor[gameBrandENCandidates.value[0].kind];
    selectedBrands.value.push(
      ...gameBrandENCandidates.value.filter(
        (brand) => brand.kind === "developer"
      )
    );
    if (selectedBrands.value.length === 0)
      selectedBrands.value.push(
        ...gameBrandENCandidates.value.filter(
          (brand) => brand.kind === "publisher"
        )
      );
    gameConfig.gameNameSlug = slugify(gameConfig.gameNameEN, "");
    slugTitleColor.value = enTitleColor.value;
  }

  const gamePath = `${props.game.basePath}/${props.game.gameBrand}${props.game.splitter}${props.game.gameName}`;
  executables.value = (await window.ipcRenderer.invoke("scanDir", gamePath))
    .filter(
      (file: DirEntry) =>
        file.isFile && file.name.toLowerCase().endsWith(".exe")
    )
    .map((file: DirEntry) => file.name);
  executables.value = await utils.guessLauncher(executables.value);
  gameConfig.executable = executables.value[0];
  executablesLoading.value = false;

  if (
    gameStore.lutrisDB.winePrefixes.includes(
      gameStore.config.lutrisDefaultWinePrefix
    )
  )
    gameConfig.winePrefix = gameStore.config.lutrisDefaultWinePrefix;
  else gameConfig.winePrefix = gameStore.lutrisDB.winePrefixes[0];

  if (
    gameStore.lutrisDB.wineRunners.includes(
      gameStore.config.lutrisDefaultWineRunner
    )
  )
    gameConfig.wineRunner = gameStore.config.lutrisDefaultWineRunner;
  else gameConfig.wineRunner = gameStore.lutrisDB.wineRunners[0];

  if (gameStore.config.locale) gameConfig.locale = gameStore.config.locale;
  else gameConfig.locale = "ja_JP.utf8";

  allLutrisCategories.value = Object.keys(
    gameStore.lutrisDB.lutrisCategories
  ).sort();
  gameConfig.lutrisCategories = await gameStore.lutrisDB.categoriesForGame(
    props.game
  );
  if (
    gameConfig.lutrisCategories.length === 0 &&
    allLutrisCategories.value.includes("Gal")
  )
    gameConfig.lutrisCategories.push("Gal");

  // Steam
  allSteamCategories.value = gameStore.steamDB.steamCategoriesNames.sort();
  gameConfig.steamCategories = gameStore.steamDB.categoriesForGame(props.game);
  if (
    gameConfig.steamCategories.length === 0 &&
    allSteamCategories.value.includes("Gal")
  )
    gameConfig.steamCategories.push("Gal");
});

async function addGameToDB() {
  dbAdding.value = true;
  const nameChanged =
    gameConfig.gameName !== props.game.gameName ||
    gameConfig.gameBrand !== props.game.gameBrand;

  if (props.game.inDatabase > 0) {
    console.log("Game already in database! Removing it...");
    // set reAdd to true if the game name is not changed
    // so the controller config will not be removed
    await props.game.removeDB(!nameChanged);
  }
  if (nameChanged) {
    console.log("Game name changed! Updating it...");
    await props.game.rename(gameConfig);
  }
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
</script>

<template>
  <v-carousel-item>
    <v-card rounded="lg" height="100%" class="pa-0 d-flex flex-column">
      <v-list class="ma-0 pa-8 flex-grow-1">
        <!-- ------------------------- Orig Title ------------------------------- -->
        <v-row class="flex-grow-0 mb-0">
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
              gameConfig.gameBrand +
                props.game.splitter +
                gameConfig.gameName ===
              folderName
                ? ''
                : gameConfig.gameBrand +
                  props.game.splitter +
                  gameConfig.gameName
            "
            persistent-hint
            v-model="folderName"
            class="vn-title-textinput"
          >
            <template #append-inner>
              <v-btn
                v-if="folderName !== props.game.folderName"
                density="compact"
                variant="plain"
                icon="$mdiReload"
                @click="folderName = props.game.folderName"
              />
              <v-btn
                density="compact"
                variant="plain"
                icon="$mdiSearchWeb"
                @click="async () => getGameENCandidates()"
                style="margin-right: -4px"
              />
            </template>
          </v-text-field>
        </v-row>

        <!-- ------------------------- Eng Title ------------------------------- -->
        <v-row class="flex-grow-0 mb-0">
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
                gameConfig.gameNameEN.length !== 0 || 'English title is empty.',
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
                  border
                  :key="item.title"
                  :value="item.title"
                  :title="item.title"
                  :subtitle="item.origTitle"
                  :class="'vn-title-kind-' + item.kind"
                  @click="
                    () => {
                      gameConfig.gameNameEN = item.title;
                      gameConfig.gameName = item.origTitle;
                      enTitleColor = titleKindColor[item.kind];
                      slugTitleColor = '';
                    }
                  "
                >
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
        <v-row class="flex-grow-0 mb-0">
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
                  border
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
                </v-list-item>
              </v-list>
            </v-menu>
          </v-text-field>
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
                gameConfig.gameNameSlug.length !== 0 || 'Game slug is empty.',
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

        <!-- ------------------------- Steam Categories / Steam Controller Layout ------------------------------- -->
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
            style="max-width: calc(100% - 200px)"
          />

          <div style="width: 40px"></div>

          <v-select
            label="Layout"
            density="compact"
            :items="gameStore.steamDB.controllerLayouts"
            v-model="gameConfig.controllerLayout"
            variant="outlined"
            prepend-icon="$mdiController"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: 160px"
          />
        </v-row>

        <!-- ------------------------- Lutris Categories / Locale ------------------------------- -->
        <v-row class="flex-grow-0 flex-nowrap">
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
            style="max-width: calc(100% - 200px)"
          />

          <div style="width: 40px"></div>

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
            style="max-width: 160px"
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

        <!-- ------------------------- Wine Prefix / Runners ------------------------------- -->
        <v-row class="flex-grow-0 flex-nowrap">
          <v-select
            label="Wine Prefix"
            density="compact"
            :items="gameStore.lutrisDB.winePrefixes"
            v-model="gameConfig.winePrefix"
            variant="outlined"
            prepend-icon="$mdiPackageVariantClosed"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: calc(50% - 20px) !important"
          />

          <div style="width: 40px"></div>

          <v-select
            label="Wine Runner"
            density="compact"
            :items="gameStore.lutrisDB.wineRunners"
            v-model="gameConfig.wineRunner"
            variant="outlined"
            prepend-icon="$customWineEmptyVariant"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
            style="max-width: calc(50% - 20px)"
          />
        </v-row>

        <!-- ------------------------- Lutris Env Setup ------------------------------- -->
        <v-row
          class="flex-grow-1 flex-shrink-1 justify-space-between flex-nowrap"
        >
          <!-- <v-col> -->
          <v-card
            border
            elevation="0"
            rounded="10"
            width="100%"
            style="margin-left: 40px"
            :loading="executablesLoading"
          >
            <v-list-subheader class="lutris-subheader">
              <v-icon
                icon="$mdiApplicationOutline"
                class="mx-1"
                style="padding-bottom: 3px"
              />
              <span>Game Executable</span>
            </v-list-subheader>
            <v-divider></v-divider>
            <v-list
              density="compact"
              @click:select="(value) => gameConfig.executable = value.id as string"
              :selected="[gameConfig.executable]"
              base-color="grey-darken-1"
              style="padding: 0"
            >
              <v-list-item
                v-for="item in executables"
                :key="item"
                :value="item"
                class="lutris-item"
              >
                <v-list-item-title>{{ item }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>

          <!-- <v-spacer class="lutris-config-spacer"></v-spacer> -->

          <!-- <v-card border elevation="0" rounded="10" width="100%">
            <v-list-subheader class="lutris-subheader">
              <v-icon
                icon="$mdiPackageVariantClosed"
                class="mx-1"
                style="padding-bottom: 3px"
              />
              <span>Wine Prefix</span>
            </v-list-subheader>
            <v-divider></v-divider>
            <v-list
              density="compact"
              @click:select="(value) => gameConfig.winePrefix = value.id as string"
              :selected="[gameConfig.winePrefix]"
              base-color="grey-darken-1"
              style="padding: 0"
            >
              <v-list-item
                v-for="item in gameStore.lutrisDB.winePrefixes"
                :key="item"
                :value="item"
                class="lutris-item"
              >
                <v-list-item-title>{{ item }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card> -->

          <!-- <v-spacer class="lutris-config-spacer"></v-spacer> -->

          <!-- <v-card border elevation="0" rounded="10" width="100%">
            <v-list-subheader class="lutris-subheader">
              <v-icon
                icon="$customWineEmptyVariant"
                class="mx-1"
                style="padding-bottom: 3px"
              />
              <span>Wine Runner</span>
            </v-list-subheader>
            <v-divider></v-divider>
            <v-list
              density="compact"
              @click:select="(value) => gameConfig.wineRunner = value.id as string"
              :selected="[gameConfig.wineRunner]"
              base-color="grey-darken-1"
              style="padding: 0"
            >
              <v-list-item
                v-for="item in gameStore.lutrisDB.wineRunners"
                :key="item"
                :value="item"
                class="lutris-item"
              >
                <v-list-item-title>{{ item }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card> -->

          <!-- <v-spacer class="lutris-config-spacer"></v-spacer> -->

          <!-- -------------------- Locale --------------------------- -->
          <!-- <v-card
            border
            elevation="0"
            rounded="10"
            width="100%"
            max-width="85px"
          >
            <v-list-subheader class="lutris-subheader">
              <v-icon icon="$mdiWeb" class="mx-1" style="padding-bottom: 3px" />
              Locale
            </v-list-subheader>
            <v-divider></v-divider>
            <v-list
              density="compact"
              @click:select="(value) => gameConfig.locale = value.id as string"
              :selected="[gameConfig.locale]"
              base-color="grey-darken-1"
              style="padding: 0"
            >
              <v-list-item
                v-for="item in [
                  'ja_JP.utf8',
                  'zh_CN.utf8',
                  'zh_HK.utf8',
                  'en_US.utf8',
                ]"
                :key="item"
                :value="item"
                class="lutris-item"
              >
                <v-list-item-title style="text-align: center">
                  <img
                    :src="`icons/${item}.svg`"
                    style="height: 18px; margin-top: 6px"
                  />
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card> -->
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
              >Remove</v-btn
            >
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
          prepend-icon="$mdiSkipNext"
          variant="outlined"
          color="grey-darken-4"
          class="ml-2"
          :disabled="dbAdding || dbRemoving"
          @click="$emit('proceed')"
          >Skip</v-btn
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
