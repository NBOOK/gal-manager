<script setup lang="ts">
import { ref, toRef, computed, watch, onMounted } from "vue";
import { useGameStore } from "@/store/global-store";
import pLimit from "p-limit";
import utils from "@/modules/utils";
import { DirSyncer, FileSyncer } from "@/modules/Synchronizer";

const limit = pLimit(50);
const gameStore = useGameStore();

// const overlay = computed({
//   get: () => gameStore.syncManager.managerOpen,
//   set: (value) => {
//     gameStore.syncManager.managerOpen = value;
//   },
// });
const overlay = toRef(gameStore, "savedataSyncOpen");
const syncConfig = ref({} as any);

onMounted(async () => {
  syncConfig.value = await window.ipcRenderer.invoke(
    "fetchJsonConfig",
    "<HOME>/.config/gal-manager/sync-config.json"
  );
  if (Object.keys(syncConfig.value).length === 0) {
    syncConfig.value = await window.ipcRenderer.invoke(
      "fetchJsonConfig",
      "<MAIN_DIST>/GalManager/sync-config_template.json"
    );
  }
});

const step = ref(0);
</script>

<template>
  <v-overlay
    v-model="overlay"
    persistent
    no-click-animation
    class="align-center justify-center"
    style="backdrop-filter: blur(1rem)"
  >
    <v-container width="100vw" max-height="100%">
      <v-carousel
        id="dbAdderCarousel"
        v-model="step"
        :show-arrows="false"
        hide-delimiters
        progress="green"
        height="95vh"
      >
        <v-carousel-item></v-carousel-item>
      </v-carousel>
    </v-container>
  </v-overlay>
</template>

<style scoped>
.sync-indicator {
  width: 50px;
  margin-left: 5px;
  margin-right: 5px;
  border-radius: 8px;
}

.sync-item {
  direction: rtl;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 12px;
  display: inline-block;
}

.sync-item-text {
  unicode-bidi: plaintext;
}

.inline-circular-progress {
  height: auto !important;
}

.v-virtual-scroll {
  padding-top: 18px;
  padding-right: calc(1em - 10px);
  /* position: relative; */
  overflow-y: scroll !important;
}

.v-virtual-scroll::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.v-virtual-scroll::-webkit-scrollbar-track {
  /* background: transparent; */
  background: #f0f0f0;
}
.v-virtual-scroll::-webkit-scrollbar-track:hover {
  background: #f0f0f0;
}

.v-virtual-scroll::-webkit-scrollbar-thumb {
  background-color: #cccccc;
  border-radius: 10px;
}

.v-virtual-scroll::-webkit-scrollbar-thumb:hover {
  background-color: #888888;
}

.behavior-toggle-btn {
  width: 24px;
}
</style>
