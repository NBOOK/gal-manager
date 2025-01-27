<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useGameStore } from "@/store/global-store";
import GameEntry from "@/modules/GameEntry";
import utils from "@/modules/utils";
import { sl } from "vuetify/locale";

const gameStore = useGameStore();
const props = defineProps<{ game: GameEntry }>();
const gameNameENCandidates = ref<VNTitle[]>([]);
const enTitleLoading = ref(true);
const isMenuOpen = ref(false);
const slugSync = ref(true);

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
  },
  { immediate: true }
);
</script>

<template>
  <v-carousel-item>
    <v-sheet rounded height="100%" class="pa-8 d-flex flex-column">
      <!-- <v-container height="100%" class="d-flex flex-column"> -->
      <v-row class="flex-grow-0">
        <v-text-field
          density="compact"
          label="Orig Title"
          variant="outlined"
          clearable
          clear-icon="mdi-backspace-outline"
          placeholder="Game's orginal title."
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

      <v-row class="flex-grow-0">
        <v-text-field
          density="compact"
          label="Slug"
          variant="outlined"
          clearable
          clear-icon="mdi-backspace-outline"
          placeholder="Game's title slug (identifier)."
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

      <v-row class="flex-grow-0">
        <v-text-field
          density="compact"
          label="EN Title"
          variant="outlined"
          clearable
          clear-icon="mdi-backspace-outline"
          placeholder="Game's English/romanized title."
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
          clear-icon="mdi-backspace-outline"
          :menu-props="{ transition: 'slide-y-transition' }"
        ></v-combobox>
      </v-row>

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
    </v-sheet>
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
</style>
