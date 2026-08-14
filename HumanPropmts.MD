**** DON"T MODIFY THIS FILE BY AI AGENTS ****

- I want to create seperate section for data analysis. Should move the current graph view in overview page to that view. And should provide more fine grained analysis. select parameter type to show in graph and data and time range ect.

- Give users ability to zoom a specific time range in the graph.

- Don't show the raw telemetry data in the table below by default. Provide a collapsible section to show/hide the raw data. When showing the raw data, provide a way to filter and sort the data.

- Make the default time range to be last 1 hour. Provide a way to select a custom time and date range

----------

- Improve UI/UX in settings page. Show current Output source priority and Charger source priority. Show a small diagram to explain what each setting does. Provide a way to reset to default settings.

- When updating a setting show a progress bar or spinner to indicate that the setting is being applied. Provide feedback to the user once the setting has been successfully updated or if there was an error.

- For the diagram, use an image like we did in the overview page.

----------- 
- In the Diagnostics page, Show a human readable text for Mode, I have seen L and B and within brackets show raw value (like L/B ect). Do the same for other parameters like Output source priority and Charger source priority

-----

- Add routing to the app. Should have a route to each individual page and query parameters to show specific data. For example, a route to the data analysis page with query parameters for parameter type and date range.


-------

- I'm using JK BMS with my battery pack of 28V (8 x 120AH prismetic batteries). I support communication over bluetooth and has inbuild bluetooth module. My Raspbery pi 3 B+ also has bluetooth module and i could connect to the BMS using bluetooth. I previously used this https://github.com/tmkasun/solar-hybrid-inverter-monitor/blob/main/inverter-api/run.jkbms.sh jkbms tool to read the data from the BMS. I want to read data from the BMS and integrate it to the app. If you want we could first write some cli tools or commands to check the possible implementation plan and then we could do the implementation.