<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import GameEntry from "@/modules/GameEntry";
import utils from "@/modules/utils";

const gameStore = useGameStore();
const emit = defineEmits(["proceed", "abort"]);
const props = defineProps<{ game: GameEntry }>();
const game = computed(() => props.game);
const gameNameENCandidates = ref<VNTitle[]>([]);
const allSteamCategories = ref<string[]>([]);
const allLutrisCategories = ref<string[]>([]);
const isMenuOpen = ref(false);
const slugSync = ref(true);
const executables = ref<string[]>([]);
const enTitleColor = ref("");
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
};

const gameConfig = reactive<GameConfig>({
  gameName: "",
  gameBrand: "",
  gameNameEN: "",
  gameNameSlug: "",
  winePrefix: "",
  wineRunner: "",
  executable: "",
  locale: "",
  controllerLayout: "avg.vdf",
  steamCategories: [],
  lutrisCategories: [],
});

async function getGameNameENCandidates(gameName: string) {
  enTitleLoading.value = true;
  gameNameENCandidates.value = await utils.getGameNameEN(gameName);
  enTitleLoading.value = false;
}

watch(
  () => gameConfig.gameNameEN,
  () => {
    gameConfig.gameNameSlug = slugify(
      gameConfig.gameNameEN,
      gameConfig.gameNameSlug
    );
  }
);

watch(
  () => props.game,
  async () => {
    gameConfig.gameName = props.game.gameName;
    gameConfig.gameBrand = props.game.gameBrand;

    await getGameNameENCandidates(props.game.gameName);

    if (props.game.inDatabase) {
      gameConfig.gameNameEN = props.game.gameNameEN;
      enTitleColor.value = "#EDE7F6";
      gameConfig.gameNameSlug = props.game.gameNameSlug;
      slugTitleColor.value = "#EDE7F6";
    } else {
      gameConfig.gameNameEN = gameNameENCandidates.value[0].title;
      enTitleColor.value = titleKindColor[gameNameENCandidates.value[0].kind];
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
    gameConfig.steamCategories = gameStore.steamDB.categoriesForGame(
      props.game
    );
    if (
      gameConfig.steamCategories.length === 0 &&
      allSteamCategories.value.includes("Gal")
    )
      gameConfig.steamCategories.push("Gal");
  },
  { immediate: true }
);

async function addGameToDB() {
  dbAdding.value = true;
  const nameChanged =
    gameConfig.gameName !== props.game.gameName ||
    gameConfig.gameBrand !== props.game.gameBrand;

  if (props.game.inDatabase > 0) {
    console.log("Game already in database! Removing it...");
    // set reAdd to true if the game name is not changed
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
      <v-list class="ma-0 pa-8">
        <!-- ------------------------- Orig Title ------------------------------- -->
        <v-row class="flex-grow-0">
          <v-text-field
            density="compact"
            label="Orig Title"
            variant="outlined"
            clearable
            clear-icon="$mdiBackspaceOutline"
            placeholder="Game's orginal title."
            prepend-icon="$mdiIdeogramCjkVariant"
            :spellcheck="false"
            v-model="gameConfig.gameName"
            class="vn-title-textinput"
          >
            <template #append-inner>
              <v-icon
                style="cursor: pointer"
                icon="$mdiSearchWeb"
                @click="getGameNameENCandidates"
              ></v-icon>
            </template> </v-text-field
        ></v-row>

        <!-- ------------------------- Eng Title ------------------------------- -->
        <v-row class="flex-grow-0">
          <v-text-field
            density="compact"
            label="EN Title"
            variant="outlined"
            clearable
            clear-icon="$mdiBackspaceOutline"
            placeholder="Game's English/romanized title."
            prepend-icon="$mdiAlphabeticalVariant"
            :spellcheck="false"
            :loading="enTitleLoading"
            v-model="gameConfig.gameNameEN"
            :bg-color="gameConfig.gameNameEN ? enTitleColor : ''"
            @input="
              () => {
                enTitleColor = '';
                slugTitleColor = '';
                isMenuOpen = false;
              }
            "
            class="vn-title-textinput"
          >
            <template #append-inner>
              <v-icon
                style="cursor: pointer"
                :class="{ 'rotate-icon': isMenuOpen }"
                icon="$mdiMenuDown"
              ></v-icon>
            </template>
            <v-menu
              activator="parent"
              location="bottom center"
              origin="top center"
              max-height="300"
              v-model="isMenuOpen"
              transition="slide-y-transition"
            >
              <v-list color="primary">
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
                    ></v-progress-circular>
                  </template>
                </v-list-item>
              </v-list>
            </v-menu>
          </v-text-field>
        </v-row>

        <!-- ------------------------- Slug Title ------------------------------- -->
        <v-row class="flex-grow-0">
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
            class="vn-title-textinput"
          >
            <template #append-inner>
              <v-icon
                style="cursor: pointer"
                :icon="slugSync ? '$mdiAutorenew' : '$mdiSyncOff'"
                @click="slugSync = !slugSync"
              ></v-icon>
            </template> </v-text-field
        ></v-row>

        <!-- ------------------------- Lutris Categories ------------------------------- -->
        <v-row class="flex-grow-0">
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
          ></v-select>
        </v-row>

        <!-- ------------------------- Steam Categories ------------------------------- -->
        <v-row class="flex-grow-0">
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
            prepend-icon="$mdiTagMultiple"
            clear-icon="$mdiBackspaceOutline"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
          ></v-select>
        </v-row>

        <!-- ------------------------- Steam Controller Layout ------------------------------- -->
        <v-row class="flex-grow-0">
          <v-select
            label="Steam Controller Layout"
            density="compact"
            :items="gameStore.steamDB.controllerLayouts"
            v-model="gameConfig.controllerLayout"
            variant="outlined"
            prepend-icon="$mdiController"
            :menu-props="{ transition: 'slide-y-transition' }"
            class="vn-title-textinput"
          ></v-select>
        </v-row>

        <!-- ------------------------- Lutris Env Setup ------------------------------- -->
        <v-row class="flex-grow-0 justify-space-between flex-nowrap">
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
              base-color="grey-darken-2"
              height="100%"
              max-height="150px"
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
          <!-- </v-col> -->
          <v-spacer class="lutris-config-spacer"></v-spacer>
          <!-- <v-col> -->
          <v-card border elevation="0" rounded="10" width="100%">
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
              base-color="grey-darken-2"
              height="100%"
              max-height="150px"
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
          </v-card>
          <!-- </v-col> -->

          <v-spacer class="lutris-config-spacer"></v-spacer>

          <!-- <v-col> -->
          <v-card border elevation="0" rounded="10" width="100%">
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
              base-color="grey-darken-2"
              height="100%"
              max-height="150px"
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
          </v-card>
          <!-- </v-col> -->

          <v-spacer class="lutris-config-spacer"></v-spacer>

          <!-- <v-col> -->
          <v-card
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
              base-color="grey-darken-2"
              height="100%"
              max-height="150px"
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
          </v-card>
          <!-- </v-col> -->
        </v-row>
      </v-list>

      <!-- ------------------------- Bottom Nav Btns ------------------------------- -->
      <v-row class="align-self-end align-end pa-8">
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
          :disabled="dbRemoving"
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

.lutris-item {
  min-height: 10px !important;
  height: 20px !important;
}
</style>
