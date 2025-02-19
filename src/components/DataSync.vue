<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useGameStore } from "@/store/global-store";
import pLimit from "p-limit";
import { DirSyncer } from "@/modules/Synchronizer";
import SyncerCore from "@/components/SyncerCore.vue";

const limit = pLimit(50);
const gameStore = useGameStore();

const syncConfig = ref({} as { [baseName: string]: SaveSyncConfig });
onMounted(async () => {
  syncConfig.value = await window.ipcRenderer.invoke(
    "fetchJsonConfig",
    "<HOME>/.config/GalManager/sync-config.json"
  );
  if (Object.keys(syncConfig.value).length === 0) {
    syncConfig.value = await window.ipcRenderer.invoke(
      "fetchJsonConfig",
      "<MAIN_DIST>/GalManager/sync-config_template.json"
    );
  }
});

const newBindName = ref<string | null>(null);
const addingNewBind = ref(false);
const loading = ref(false);

function addingNewBindHandler() {
  if (newBindName.value) {
    syncConfig.value[newBindName.value] = {
      remotePath: "",
      localPath: "",
      items: [],
    };
    newBindName.value = null;
    addingNewBind.value = false;
  }
}

async function saveAndScanBinds() {
  loading.value = true;
  window.ipcRenderer.invoke(
    "saveJsonConfig",
    JSON.stringify(syncConfig.value),
    "<HOME>/.config/GalManager/sync-config.json"
  );
  await scanBindDirs();
  loading.value = false;
  step.value = 1;
}

//

const scannedDirNames = reactive({} as { [baseName: string]: string[] });
// const excludedDirNames = computed(() => {
//   const result = {} as { [baseName: string]: string[] };
//   for (const baseName of Object.keys(syncConfig.value)) {
//     result[baseName] = scannedDirNames[baseName].filter(
//       (dirName) => !syncConfig.value[baseName].items.includes(dirName)
//     );
//   }
//   return result;
// });

async function scanBindDirs() {
  for (const baseName of Object.keys(syncConfig.value)) {
    const remotePath: string = syncConfig.value[baseName].remotePath;
    const localPath: string = syncConfig.value[baseName].localPath;
    const remoteDirs = (await window.ipcRenderer.invoke("scanDir", remotePath))
      .filter((dirEntry: DirEntry) => dirEntry.isDirectory)
      .map((dirEntry: DirEntry) => dirEntry.name);
    const localDirs = (await window.ipcRenderer.invoke("scanDir", localPath))
      .filter((dirEntry: DirEntry) => dirEntry.isDirectory)
      .map((dirEntry: DirEntry) => dirEntry.name);

    scannedDirNames[baseName] = Array.from(
      new Set([...remoteDirs, ...localDirs])
    );

    syncConfig.value[baseName].items = syncConfig.value[baseName].items.filter(
      (dirName) => scannedDirNames[baseName].includes(dirName)
    );
  }
}

async function saveAndScanDiffs() {
  loading.value = true;

  window.ipcRenderer.invoke(
    "saveJsonConfig",
    JSON.stringify(syncConfig.value),
    "<HOME>/.config/GalManager/sync-config.json"
  );
  await scanDiffs();

  loading.value = false;
  step.value = 2;
}

async function scanDiffs() {
  const dirSyncers: DirSyncer[] = [];
  for (const [bindName, config] of Object.entries(syncConfig.value)) {
    const remoteBasePath = config.remotePath;
    const localBasePath = config.localPath;
    for (const dirName of config.items) {
      dirSyncers.push(
        new DirSyncer(
          `${remoteBasePath}/${dirName}`,
          `${localBasePath}/${dirName}`,
          [],
          [],
          bindName
        )
      );
    }
  }
  // for (const bindName of Object.keys(syncConfig.value)) {
  //   const config = syncConfig.value[bindName];
  //   dirSyncers.push(
  //     new DirSyncer(
  //       config.remotePath,
  //       config.localPath,
  //       [],
  //       excludedDirNames.value[bindName]
  //     )
  //   );
  // }
  await Promise.all(
    dirSyncers.map((dirSyncer) =>
      limit(async () => {
        await dirSyncer.scan();
        await dirSyncer.setStrategy("newest");
      })
    )
  );
  console.log(dirSyncers);
  const validDirSyncers = dirSyncers.filter(
    (dirSyncer) => dirSyncer.fileSyncers.length > 0
  );
  console.log(validDirSyncers);
  if (validDirSyncers.length > 0) {
    gameStore.dataSyncManager.syncList.push(...validDirSyncers);
  } else {
    gameStore.dataSyncManager.managerOpen = false;
  }
}

const step = ref(0);

async function pathMustExist(path: string) {
  if (!path) return "This field is required";
  if (!(await window.ipcRenderer.invoke("fileExists", path)))
    return "Path does not exist";
  return true;
}
function fieldRequired(value: string) {
  return !!value || "This field is required";
}
function bindNameExists(value: string) {
  return !syncConfig.value[value] || "This name already exists";
}
function endsWithSlash(path: string) {
  return !path.endsWith("/") || "Path must not ends with a slash";
}
</script>

<template>
  <v-overlay
    v-model="gameStore.dataSyncManager.managerOpen"
    persistent
    no-click-animation
    class="align-center justify-center"
    style="backdrop-filter: blur(1rem)"
  >
    <v-container width="100vw" max-height="100%">
      <v-carousel
        v-model="step"
        :show-arrows="false"
        hide-delimiters
        progress="green"
        height="95vh"
      >
        <!-- Step 1 -->
        <v-carousel-item>
          <v-sheet
            rounded="lg"
            width="100%"
            height="100%"
            min-width="680px"
            class="pa-8 d-flex flex-column"
          >
            <v-list style="margin-right: -2em; padding-right: 1em">
              <v-row
                v-for="(baseName, index) in Object.keys(syncConfig)"
                :key="index"
                class="flex-nowrap align-center justify-center ma-0 mb-1"
              >
                <v-btn
                  icon="$mdiMinusCircleOutline"
                  variant="plain"
                  color="red-lighten-2"
                  class="mb-5 mr-2"
                  density="compact"
                  style="visibility: hidden"
                />
                <v-text-field
                  v-model="syncConfig[baseName].remotePath"
                  :label="baseName + ' Remote Path'"
                  :rules="[fieldRequired, pathMustExist, endsWithSlash]"
                  :spellcheck="false"
                  clearable
                  clear-icon="$mdiBackspaceOutline"
                  variant="outlined"
                  density="compact"
                  class="flex-grow-0"
                  style="width: calc(100% - 28px - 24px - 28px)"
                >
                </v-text-field>
                <v-icon class="ma-2 mb-7">$mdiArrowLeftRightBold</v-icon>
                <v-text-field
                  v-model="syncConfig[baseName].localPath"
                  :label="baseName + ' Local Path'"
                  :rules="[fieldRequired, pathMustExist, endsWithSlash]"
                  :spellcheck="false"
                  clearable
                  clear-icon="$mdiBackspaceOutline"
                  variant="outlined"
                  density="compact"
                  class="flex-grow-0"
                  style="width: calc(100% - 28px - 24px - 28px)"
                >
                </v-text-field>
                <v-btn
                  icon="$mdiMinusCircleOutline"
                  variant="plain"
                  color="red-lighten-2"
                  class="mb-5 ml-2"
                  density="compact"
                  @click="delete syncConfig[baseName]"
                />
              </v-row>
              <v-expand-transition>
                <v-text-field
                  v-if="addingNewBind"
                  v-model="newBindName"
                  :rules="[fieldRequired, bindNameExists]"
                  :append-inner-icon="newBindName ? '$mdiCheckBold' : ''"
                  @click:append-inner="addingNewBindHandler"
                  @keyup.enter="addingNewBindHandler"
                  @keyup.esc="addingNewBind = false"
                  @blur="addingNewBind = false"
                  variant="outlined"
                  density="compact"
                  label="New Sync Name"
                  style="margin: 0 36px"
                ></v-text-field>
              </v-expand-transition>

              <v-row class="ma-0 flex-nowrap align-center justify-center">
                <v-divider />
                <v-btn
                  icon="$mdiPlusCircleOutline"
                  variant="plain"
                  color="green-lighten-2"
                  density="compact"
                  @click="addingNewBind = true"
                />
                <v-divider />
              </v-row>
            </v-list>
            <v-row class="ma-0 align-self-end align-end">
              <v-btn
                variant="outlined"
                text="Cancel"
                color="grey-darken-4"
                class="mr-3"
                @click="gameStore.dataSyncManager.managerOpen = false"
              />
              <v-btn
                variant="outlined"
                text="Save and Scan"
                color="green"
                :loading="loading"
                @click="saveAndScanBinds"
              />
            </v-row>
          </v-sheet>
        </v-carousel-item>

        <!-- Step 2 -->
        <v-carousel-item>
          <v-sheet
            rounded="lg"
            width="100%"
            height="100%"
            min-width="680px"
            class="pa-8 d-flex flex-column"
          >
            <v-list style="margin-right: -2em; padding-right: 1em">
              <v-combobox
                v-for="(baseName, index) in Object.keys(scannedDirNames)"
                :key="index"
                v-model="syncConfig[baseName].items"
                :label="baseName"
                :items="scannedDirNames[baseName]"
                multiple
                chips
                closable-chips
                hide-selected
                variant="outlined"
              />
            </v-list>
            <v-row class="ma-0 align-self-end align-end">
              <v-btn
                variant="outlined"
                text="Cancel"
                color="grey-darken-4"
                class="mr-3"
                @click="gameStore.dataSyncManager.managerOpen = false"
              />
              <v-btn
                variant="outlined"
                text="Save and Scan"
                color="green"
                :loading="loading"
                @click="saveAndScanDiffs"
              />
            </v-row>
          </v-sheet>
        </v-carousel-item>

        <!-- Step 3: Sync Core Page -->
        <v-carousel-item>
          <SyncerCore :manager="gameStore.dataSyncManager" />
        </v-carousel-item>
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

::-webkit-scrollbar {
  /* display: none; */
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

.behavior-toggle-btn {
  width: 24px;
}
</style>
