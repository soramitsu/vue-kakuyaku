<template>
  <Promised :promise="myAction">
    <template #default="data">{{ data }}</template>
    <template #pending>...</template>
  </Promised>

  <Promised :promise="myAction">
    <template #combined="{ data, error, isPending }">
      Данные: {{ data }} <br />
      Ошибка: {{ error }} <br />
      Загружается? {{ isPending }}
    </template>
  </Promised>
</template>
