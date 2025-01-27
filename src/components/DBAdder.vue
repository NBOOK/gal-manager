<script setup lang="ts">
import { reactive, ref, toValue, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import GameEntry from "@/modules/GameEntry";
import utils from "@/modules/utils";
import { id } from "vuetify/locale";

const gameStore = useGameStore();
const props = defineProps<{ game: GameEntry }>();
const gameNameENCandidates = ref<VNTitle[]>([]);
const enTitleLoading = ref(true);
const isMenuOpen = ref(false);
const slugSync = ref(true);
const executables = ref<string[]>([]);
const executablesLoading = ref(true);

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

const gameConnfig = reactive({
  gameName: "",
  gameNameEN: "",
  gameNameENColor: "",
  gameNameSlug: "",
  gameNameSlugColor: "",
  winePrefix: "",
  wineRunner: "",
  executable: "",
  locale: "",
});

async function getGameNameENCandidates() {
  enTitleLoading.value = true;
  gameNameENCandidates.value = await utils.getGameNameEN(gameConnfig.gameName);
  gameConnfig.gameNameEN = gameNameENCandidates.value[0].title;
  gameConnfig.gameNameENColor =
    titleKindColor[gameNameENCandidates.value[0].kind];
  gameConnfig.gameNameSlug = slugify(gameConnfig.gameNameEN, "");
  enTitleLoading.value = false;
}

watch(
  () => props.game,
  async () => {
    gameConnfig.gameName = props.game.gameName;
    if (props.game.inDatabase) {
      gameNameENCandidates.value = await utils.getGameNameEN(
        props.game.gameName
      );
      gameConnfig.gameNameEN = props.game.gameNameEN;
      gameConnfig.gameNameENColor = "#F3E5F5";
      gameConnfig.gameNameSlug = props.game.gameNameSlug;
      gameConnfig.gameNameSlugColor = "#F3E5F5";
      enTitleLoading.value = false;
    } else {
      await getGameNameENCandidates();
    }

    const gamePath = `${props.game.basePath}/${props.game.gameBrand}${props.game.splitter}${props.game.gameName}`;
    executables.value = (await window.ipcRenderer.invoke("scanDir", gamePath))
      .filter((file: DirEntry) => file.isFile && file.name.endsWith(".exe"))
      .map((file: DirEntry) => file.name);
    executables.value = await utils.guessLauncher(executables.value);
    gameConnfig.executable = executables.value[0];
    executablesLoading.value = false;

    gameConnfig.winePrefix = gameStore.lutrisDB.winePrefixes[0];
    gameConnfig.wineRunner = gameStore.lutrisDB.wineRunners[0];
    gameConnfig.locale = "ja_JP.utf8";
  },
  { immediate: true }
);
</script>

<template>
  <v-carousel-item>
    <v-card rounded="10" height="100%" class="pa-8 d-flex flex-column">
      <!-- ------------------------- Orig Title ------------------------------- -->
      <v-row class="flex-grow-0">
        <v-text-field
          density="compact"
          label="Orig Title"
          variant="outlined"
          clearable
          clear-icon="mdi-backspace-outline"
          placeholder="Game's orginal title."
          prepend-icon="mdi-ideogram-cjk-variant"
          :spellcheck="false"
          v-model="gameConnfig.gameName"
        >
          <template #append-inner>
            <v-icon
              style="cursor: pointer"
              icon="mdi-search-web"
              @click="getGameNameENCandidates"
            ></v-icon>
          </template> </v-text-field
      ></v-row>

      <!-- ------------------------- Slug Title ------------------------------- -->
      <v-row class="flex-grow-0">
        <v-text-field
          density="compact"
          label="Slug"
          variant="outlined"
          clearable
          clear-icon="mdi-backspace-outline"
          placeholder="Game's title slug (identifier)."
          prepend-icon="mdi-identifier"
          :spellcheck="false"
          v-model="gameConnfig.gameNameSlug"
          :bg-color="
            gameConnfig.gameNameSlug ? gameConnfig.gameNameSlugColor : ''
          "
          @input="
            () => {
              gameConnfig.gameNameSlugColor = '';
              slugSync = false;
            }
          "
        >
          <template #append-inner>
            <v-icon
              style="cursor: pointer"
              :icon="slugSync ? 'mdi-sync' : 'mdi-sync-off'"
              @click="slugSync = !slugSync"
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
          clear-icon="mdi-backspace-outline"
          placeholder="Game's English/romanized title."
          prepend-icon="mdi-alphabetical-variant"
          :spellcheck="false"
          :loading="enTitleLoading"
          v-model="gameConnfig.gameNameEN"
          :bg-color="gameConnfig.gameNameEN ? gameConnfig.gameNameENColor : ''"
          @input="
            () => {
              gameConnfig.gameNameENColor = '';
              gameConnfig.gameNameSlug = slugify(
                gameConnfig.gameNameEN,
                gameConnfig.gameNameSlug
              );
              gameConnfig.gameNameSlugColor = '';
              isMenuOpen = false;
            }
          "
        >
          <template #append-inner>
            <v-icon
              style="cursor: pointer"
              :class="{ 'rotate-icon': isMenuOpen }"
              icon="mdi-menu-down"
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
                    gameConnfig.gameNameEN = item.title;
                    gameConnfig.gameNameENColor = titleKindColor[item.kind];
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

      <!-- ------------------------- Steam/Lutris Categories ------------------------------- -->
      <!-- @TODO add lutris category support -->
      <v-row class="flex-grow-0">
        <v-combobox
          label="Steam/Lutris Categories"
          density="compact"
          clearable
          chips
          hide-selected
          multiple
          :items="['Gal', 'Anime', 'RPG', 'Emulation', 'Rhythm']"
          variant="outlined"
          prepend-icon="mdi-tag-multiple"
          clear-icon="mdi-backspace-outline"
          :menu-props="{ transition: 'slide-y-transition' }"
        ></v-combobox>
      </v-row>

      <!-- ------------------------- Lutris Env Setup ------------------------------- -->
      <v-row class="flex-grow-0 justify-space-between flex-nowrap">
        <!-- <v-col> -->
        <v-card
          border
          elevation="0"
          rounded="10"
          width="100%"
          style="margin-left: 38px"
        >
          <v-list-subheader
            style="
              height: 32px !important;
              min-height: 10px !important;
              font-size: 16px !important;
              padding-left: 16px;
            "
            >Game Executable</v-list-subheader
          >
          <v-divider></v-divider>
          <v-list
            density="compact"
            @click:select="(value) => gameConnfig.executable = value.id as string"
            :selected="[gameConnfig.executable]"
            active-color="grey-darken-2"
            height="100%"
            max-height="150px"
          >
            <v-list-item
              v-for="item in executables"
              :key="item"
              :value="item"
              style="min-height: 10px !important; height: 24px !important"
            >
              <v-list-item-title>{{ item }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
        <!-- </v-col> -->
        <v-spacer class="lutris-config-spacer"></v-spacer>
        <!-- <v-col> -->
        <v-card border elevation="0" rounded="10" width="100%">
          <v-list-subheader
            style="
              height: 32px !important;
              min-height: 10px !important;
              font-size: 16px !important;
              padding-left: 16px;
            "
            >Wine Prefix</v-list-subheader
          >
          <v-divider></v-divider>
          <v-list
            density="compact"
            @click:select="(value) => gameConnfig.winePrefix = value.id as string"
            :selected="[gameConnfig.winePrefix]"
            active-color="grey-darken-2"
            height="100%"
            max-height="150px"
          >
            <v-list-item
              v-for="item in gameStore.lutrisDB.winePrefixes"
              :key="item"
              :value="item"
              style="min-height: 10px !important; height: 24px !important"
            >
              <v-list-item-title>{{ item }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
        <!-- </v-col> -->

        <v-spacer class="lutris-config-spacer"></v-spacer>

        <!-- <v-col> -->
        <v-card border elevation="0" rounded="10" width="100%">
          <v-list-subheader
            style="
              height: 32px !important;
              min-height: 10px !important;
              font-size: 16px !important;
              padding-left: 16px;
            "
            >Wine Runner</v-list-subheader
          >
          <v-divider></v-divider>
          <v-list
            density="compact"
            @click:select="(value) => gameConnfig.wineRunner = value.id as string"
            :selected="[gameConnfig.wineRunner]"
            active-color="grey-darken-2"
            height="100%"
            max-height="150px"
          >
            <v-list-item
              v-for="item in gameStore.lutrisDB.wineRunners"
              :key="item"
              :value="item"
              style="min-height: 10px !important; height: 24px !important"
            >
              <v-list-item-title>{{ item }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
        <!-- </v-col> -->

        <v-spacer class="lutris-config-spacer"></v-spacer>

        <!-- <v-col> -->
        <v-card border elevation="0" rounded="10" width="100%" max-width="86px">
          <v-list-subheader
            style="
              height: 32px !important;
              min-height: 10px !important;
              font-size: 16px !important;
              padding-left: 16px;
            "
            >Locale</v-list-subheader
          >
          <v-divider></v-divider>
          <v-list
            density="compact"
            @click:select="(value) => gameConnfig.locale = value.id as string"
            :selected="[gameConnfig.locale]"
            active-color="grey-darken-2"
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
              style="min-height: 10px !important; height: 24px !important"
            >
              <v-list-item-title style="text-align: center">
                <img
                  :src="`/icons/${item}.svg`"
                  style="height: 24px; width: 24px"
                />
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
        <!-- </v-col> -->
      </v-row>

      <!-- ------------------------- Bottom Nav Btns ------------------------------- -->
      <v-row class="align-self-end align-end">
        <v-hover>
          <template v-slot:default="{ isHovering, props }">
            <v-btn
              v-bind="props"
              :prepend-icon="isHovering ? 'mdi-delete-empty' : 'mdi-delete'"
              variant="outlined"
              :color="isHovering ? 'red' : 'grey-darken-4'"
              class="ml-2"
              @click="$emit('abort')"
              >Remove</v-btn
            >
          </template>
        </v-hover>
        <v-btn
          prepend-icon="mdi-stop"
          variant="outlined"
          color="grey-darken-4"
          class="ml-2"
          @click="$emit('abort')"
          >Stop</v-btn
        >
        <v-btn
          prepend-icon="mdi-skip-next"
          variant="outlined"
          color="grey-darken-4"
          class="ml-2"
          @click="$emit('proceed')"
          >Skip</v-btn
        >
        <v-btn
          prepend-icon="mdi-database-edit"
          variant="outlined"
          color="green"
          class="ml-2"
          @click="
            () => {
              $emit('proceed');
            }
          "
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

.cover-mask {
  position: absolute;
  background: #fff;
  /* pointer-events: none; */
  height: 100%;
  top: 0;
  right: 0;
  width: 10px;
  transition: all 0.5s;
  opacity: 1;
}

.cover-mask.hidden {
  pointer-events: none;
  opacity: 0;
}

.lutris-config-spacer {
  width: 100%;
  max-width: 24px;
  min-width: 0px;
  flex-shrink: 1.25;
}
</style>
