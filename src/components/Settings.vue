<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type { VTextField } from "vuetify/components";
import { useGameStore } from "@/store/global-store";

const gameStore = useGameStore();
const config = ref({} as any);

const formRef = ref<InstanceType<typeof VTextField> | null>(null);
const valid = ref(false);

onMounted(async () => {
  console.log("Settings component mounted");
  if (Object.keys(gameStore.config.value).length === 0) {
    config.value = await window.ipcRenderer.invoke(
      "fetchJsonConfig",
      "<MAIN_DIST>/template/config_template.json"
    );
    console.log("Config template fetched:", config.value);
  } else {
    console.log("Config already exists:", gameStore.config.value);
    config.value = JSON.parse(JSON.stringify(gameStore.config.value));
    console.log("Config copied:", config.value);
  }
  console.log("Settings opened, current config:", config.value);
});

async function pathMustExist(path: string) {
  if (!path) return "This field is required";
  if (path.includes("<STEAM_ID>")) {
    path = path.replace("<STEAM_ID>", config.value.steam.id);
  }
  if (!(await window.ipcRenderer.invoke("fileExists", path)))
    return "Path does not exist";
  return true;
}
function fieldRequired(value: string) {
  return !!value || "This field is required";
}
function endsWithSlash(path: string) {
  return !path.endsWith("/") || "Path must not ends with a slash";
}
function sameSteamID(value: string) {
  return (
    value.includes("<STEAM_ID>") ||
    value.includes(config.value.steam.id) ||
    "Steam ID must be the same"
  );
}

const wineRunners = ref(["default"]);
const winePrefixes = ref(["default"]);

watch(
  () => config.value.wineRunnerPath,
  async () => {
    wineRunners.value = await getWineRunners();
  }
);
watch(
  () => config.value.winePrefixPath,
  async () => {
    winePrefixes.value = await getWinePrefixes();
  }
);

watch(
  () => config.value.steam?.id,
  () => {
    formRef.value?.validate();
  }
);

async function getWineRunners() {
  if ((await pathMustExist(config.value.wineRunnerPath)) === true) {
    console.log("Scanning wine runners: ", config.value.wineRunnerPath);
    const runners = (
      await window.ipcRenderer.invoke("scanDir", config.value.wineRunnerPath)
    )
      .filter((item: DirEntry) => item.isDirectory)
      .map((item: DirEntry) => item.name)
      .sort((a: string, b: string) => {
        if (a.includes("latest") === b.includes("latest")) {
          return a.localeCompare(b);
        }
        return a.includes("latest") ? -1 : 1;
      });
    runners.unshift("default");
    return runners;
  }
  return ["default"];
}

async function getWinePrefixes() {
  if ((await pathMustExist(config.value.winePrefixPath)) === true) {
    const prefixes = (
      await window.ipcRenderer.invoke("scanDir", config.value.winePrefixPath)
    )
      .filter((item: DirEntry) => item.isDirectory)
      .map((item: DirEntry) => item.name)
      .sort((a: string, b: string) => {
        if (a.includes("ADV") === b.includes("ADV")) {
          return a.localeCompare(b);
        }
        return a.includes("ADV") ? -1 : 1;
      });
    prefixes.unshift("default");
    return prefixes;
  }
  return ["default"];
}

async function saveAndRestart() {
  await window.ipcRenderer.invoke(
    "saveJsonConfig",
    JSON.stringify(config.value)
  );
  console.log("Config saved:", config.value);

  const steamConfig = config.value.steam;
  if (steamConfig && steamConfig.id) {
    Object.keys(steamConfig).forEach((key) => {
      if (key !== "id" && typeof steamConfig[key] === "string") {
        steamConfig[key] = steamConfig[key].replace(
          /<STEAM_ID>/g,
          steamConfig.id
        );
      }
    });
  }

  if (
    !(await window.ipcRenderer.invoke(
      "fileExists",
      `<HOME>/.config/GalManager/sync-config.json`
    ))
  ) {
    await window.ipcRenderer.invoke(
      "start-copy",
      `<MAIN_DIST>/template/sync-config_template.json`,
      `<HOME>/.config/GalManager/sync-config.json`
    );
    console.log("Sync config created");
  }
  if (
    !(await window.ipcRenderer.invoke(
      "fileExists",
      `<HOME>/.config/GalManager/controller_layouts/avg.vdf`
    ))
  ) {
    await window.ipcRenderer.invoke(
      "start-copy",
      `<MAIN_DIST>/template/controller_layouts/avg_template.vdf`,
      `<HOME>/.config/GalManager/controller_layouts/avg.vdf`
    );
    console.log("Controller layout created");
  }
  if (
    !(await window.ipcRenderer.invoke(
      "fileExists",
      `${config.value.steam.controllerTemplatePath}/avg.vdf`
    ))
  ) {
    await window.ipcRenderer.invoke(
      "createSymbolicLink",
      `<HOME>/.config/GalManager/controller_layouts/avg.vdf`,
      `${config.value.steam.controllerTemplatePath}/avg.vdf`
    );
    console.log("Controller layout linked to Steam");
  }

  await window.ipcRenderer.invoke("restartApp");
}
</script>

<template>
  <v-overlay
    v-model="gameStore.settingsOpen"
    no-click-animation
    persistent
    class="align-center justify-center"
    style="backdrop-filter: blur(1rem)"
  >
    <v-container width="100vw" max-height="100%">
      <v-sheet
        width="100%"
        min-width="680px"
        height="95vh"
        rounded="lg"
        class="pa-8 d-flex flex-column"
      >
        <v-list class="pa-3">
          <v-form
            ref="formRef"
            v-model="valid"
            validate-on="eager"
            slim
            density="compact"
          >
            <v-text-field
              v-model="config.gamesMainPath"
              label="Main Games Mount Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.gamesDataPath"
              label="Data Games Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.gamesSDPath"
              label="SDCard Games Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.gamesNetPath"
              label="Net Disk Games Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.gamesAssetsPath"
              label="Games Image Assets Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.assetsFolderName"
              label="Image Assets Folder Name"
              :rules="[fieldRequired]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.assetsCapsuleName"
              label="Image Assets Capsule Name"
              :rules="[fieldRequired]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.assetsHeaderName"
              label="Image Assets Header Name"
              :rules="[fieldRequired]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.assetsHeroName"
              label="Image Assets Hero Name"
              :rules="[fieldRequired]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.assetsLogoName"
              label="Image Assets Logo Name"
              :rules="[fieldRequired]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.assetsIconName"
              label="Image Assets Icon Name"
              :rules="[fieldRequired]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.assetsLowResSuffix"
              label="Image Assets Low Resolution Suffix"
              :rules="[fieldRequired]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.assetsLowResFormat"
              label="Image Assets Low Resolution Format"
              :rules="[fieldRequired, (v:string) => v === 'jpg' || v === 'webp' ? true : 'Only jpg or webp']"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-select
              v-model="config.assetsLinkLowRes"
              label="Link Low Resolution Images"
              :items="[
                { title: 'Yes', value: true },
                { title: 'No', value: false },
              ]"
              variant="outlined"
              density="compact"
              class="mb-1"
            />

            <v-divider :thickness="3" class="mb-5"></v-divider>

            <v-text-field
              v-model="config.wineRunnerPath"
              label="Wine Runner Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-model="config.winePrefixPath"
              label="Wine Prefix Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-select
              v-model="config.defaultLocale"
              label="Default Locale"
              :items="[
                { title: 'Japanese', value: 'ja_JP.utf8' },
                { title: 'Simplified Chinese', value: 'zh_CN.utf8' },
                { title: 'Traditional Chinese', value: 'zh_HK.utf8' },
                { title: 'English', value: 'en_US.utf8' },
              ]"
              variant="outlined"
              density="compact"
              class="mb-1"
            />

            <v-divider :thickness="3" class="mb-5"></v-divider>

            <v-text-field
              v-if="config.steam"
              v-model="config.steam.id"
              label="Steam ID"
              :rules="[fieldRequired]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.steam"
              v-model="config.steam.shortcutPath"
              label="Steam Shortcuts Path"
              :rules="[fieldRequired, pathMustExist, sameSteamID]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.steam"
              v-model="config.steam.localConfigPath"
              label="Steam Local Config Path"
              :rules="[fieldRequired, pathMustExist, sameSteamID]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.steam"
              v-model="config.steam.gridPath"
              label="Steam Grid Path"
              :rules="[
                fieldRequired,
                pathMustExist,
                endsWithSlash,
                sameSteamID,
              ]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.steam"
              v-model="config.steam.onlineCategoryPath"
              label="Steam LevelDB Path"
              :rules="[
                fieldRequired,
                pathMustExist,
                endsWithSlash,
                sameSteamID,
              ]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.steam"
              v-model="config.steam.controllerTemplatePath"
              label="Steam Controller Template Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.steam"
              v-model="config.steam.controllerConfigPath"
              label="Steam Controller Configurations Path"
              :rules="[
                fieldRequired,
                pathMustExist,
                endsWithSlash,
                sameSteamID,
              ]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />

            <v-divider :thickness="3" class="mb-5"></v-divider>

            <v-text-field
              v-if="config.lutris"
              v-model="config.lutris.steamTargetPath"
              label="Lutris Bin Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.lutris"
              v-model="config.lutris.steamStartIn"
              label="Lutris Working Directory"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.lutris"
              v-model="config.lutris.steamLaunchOptions"
              label="Lutris Launch Options"
              :rules="[fieldRequired]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.lutris"
              v-model="config.lutris.gameConfigPath"
              label="Lutris Game Configurations Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.lutris"
              v-model="config.lutris.gameListPath"
              label="Lutris Game List Path"
              :rules="[fieldRequired, pathMustExist]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.lutris"
              v-model="config.lutris.dbPath"
              label="Lutris Database Path"
              :rules="[fieldRequired, pathMustExist]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.lutris"
              v-model="config.lutris.iconPath"
              label="Lutris Icons Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.lutris"
              v-model="config.lutris.bannerPath"
              label="Lutris Banners Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.lutris"
              v-model="config.lutris.coverPath"
              label="Lutris Covers Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-select
              v-if="config.lutris"
              v-model="config.lutris.defaultWineRunner"
              label="Lutris Default Wine Runner"
              :items="wineRunners"
              variant="outlined"
              density="compact"
              class="mb-1"
              height="40px"
            />
            <v-select
              v-if="config.lutris"
              v-model="config.lutris.defaultWinePrefix"
              label="Lutris Default Wine Prefix"
              :items="winePrefixes"
              variant="outlined"
              density="compact"
              class="mb-1"
            />

            <v-divider :thickness="3" class="mb-5"></v-divider>

            <v-text-field
              v-if="config.heroic"
              v-model="config.heroic.steamTargetPath"
              label="Heroic Bin Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.heroic"
              v-model="config.heroic.steamStartIn"
              label="Heroic Working Directory"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.heroic"
              v-model="config.heroic.steamLaunchOptions"
              label="Heroic Launch Options"
              :rules="[fieldRequired]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.heroic"
              v-model="config.heroic.gameConfigPath"
              label="Heroic Game Configurations Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.heroic"
              v-model="config.heroic.gameListPath"
              label="Heroic Game List Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-text-field
              v-if="config.heroic"
              v-model="config.heroic.configPath"
              label="Heroic Configuration Path"
              :rules="[fieldRequired, pathMustExist, endsWithSlash]"
              :spellcheck="false"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
            <v-select
              v-if="config.heroic"
              v-model="config.heroic.defaultWineRunner"
              label="Heroic Default Wine Runner"
              :items="wineRunners"
              variant="outlined"
              density="compact"
              class="mb-1"
              height="40px"
            />
            <v-select
              v-if="config.heroic"
              v-model="config.heroic.defaultWinePrefix"
              label="Heroic Default Wine Prefix"
              :items="winePrefixes"
              variant="outlined"
              density="compact"
              class="mb-1"
            />
          </v-form>
        </v-list>
        <v-row class="mt-5 mr-5 justify-end">
          <v-btn
            v-if="Object.keys(gameStore.config.value).length"
            variant="outlined"
            color="grey-darken-4"
            prepend-icon="$mdiStop"
            @click="gameStore.settingsOpen = false"
            class="mr-3"
          >
            Cancel
          </v-btn>
          <v-btn
            variant="outlined"
            color="green"
            prepend-icon="$mdiContentSave"
            @click="saveAndRestart"
            :disabled="!valid"
          >
            Save and Restart
          </v-btn>
        </v-row>
      </v-sheet>
    </v-container>
  </v-overlay>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  /* background: transparent; */
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
</style>
