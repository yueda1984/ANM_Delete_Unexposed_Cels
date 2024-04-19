/*
	Delete Unexposed Cels

	A Harmony script for deleting Cels that are unexposed in the Timeline.
	This will also delete cels that are only used after the scene's last frame.
	You can select an entire group to remove unexposed cels. Tested with Harmony Premium 14.
	
		v1.5 - Confirmation box can now be skipped if hold down shift key while calling the script.
		v1.6 - Bug fix. No longer deletes cels that are shared over multiple nodes as long as one of the instances is exposed.
		v1.61 - "drawing.elementMode" attribute is changed to "drawing.ELEMENT_MODE" to accomodate Harmony 22 update.

		
	Installation:
	
	1) Download and unarchive the zip file.
	2) Locate to your user scripts folder (a hidden folder):
	   https://docs.toonboom.com/help/harmony-17/premium/scripting/import-script.html	
	   
	3) Add all unzipped files (*.js and script-icons folder) directly to the folder above.
	4) Add ANM_Delete_Unexposed_Cels to any toolbar.	
	
	
	Direction:
	
	Select drawing module(s) or groups that contain drawings. Run ANM_Delete_Unexposed_Cels.


	Author:

		Yu Ueda (raindropmoment.com)		
*/



function ANM_Delete_Unexposed_Cels()
{
	main_function();
	
	function main_function()	
	{	
		var pf = new private_functions;
		var sNodes = selection.selectedNodes();
		var drawingList = pf.getDrawingList(sNodes);	
		
		if (drawingList.length <= 0)
		{
			MessageBox.information("Please select at least one drawing node/layer before running this script.");
			return;
		}
		if (!KeyModifiers.IsShiftPressed())
		{
			var userHitOK = pf.confirmBox(drawingList.length);
			if (!userHitOK){return;}
		}

		scene.beginUndoRedoAccum("Remove Unexposed Cels");

		var elems = pf.checkForSharedElems(drawingList);
		pf.getExposedCelList(elems);

		scene.endUndoRedoAccum();
	}



	function private_functions()
	{
		this.getDrawingList = function(nodeList)
		{
			var drawingList = [];
			
			for (var i = 0; i < nodeList.length; i++)
			{
				var curNode = nodeList[i];
				
				if (node.type(curNode) == "READ")
				{
					drawingList.push(curNode);
				}
				else if (node.type(curNode) == "GROUP")
				{
					var subNodeList = node.subNodes(curNode);
					var subDrawingArray = this.getDrawingList(subNodeList);
					drawingList.push.apply(drawingList, subDrawingArray);
				}
			}
			return drawingList;
		}


		this.confirmBox = function(num)
		{
			var dialog = new Dialog();
			dialog.title = "Delete Unexposed Cels";
			dialog.width = 400;
			var input1 = new TextEdit;
			input1.label = "";
			input1.text = "You are about to delete unexposed cels on " + num + " drawing nodes.\n\n\nTip: You can skip this confirmation dialog from popping up by\nholding down shift while pressing on the script's icon :)";
			dialog.add(input1);		
			if (!dialog.exec())
			{
				return false;
			}
			return true;			
		}	

		
		this.checkForSharedElems = function(selectedNodes)
		{
			// get all drawing nodes in the scene
			var sceneNodeList = node.getNodes(["READ"]);
			
			var elems = {}; checkedElems = []
			for (var n = 0; n < sceneNodeList.length; n++)
			{
				var curNode = sceneNodeList[n];
				var useTiming = node.getAttr(curNode, 1, "drawing.ELEMENT_MODE").boolValue();
				var drawColumn = node.linkedColumn(curNode, useTiming ? "drawing.element" : "drawing.customName.timing");			
				var elemId = column.getElementIdOfDrawing(drawColumn);
				if (checkedElems.indexOf(elemId) == -1)
				{	
					elems[elemId] = {};
					elems[elemId][0] = {node: curNode, col: drawColumn};	
					checkedElems.push(elemId);				
				}				
				else
				{		
					var idx = Object.keys(elems[elemId]).length;
					elems[elemId][idx] = {node: curNode, col: drawColumn};						
				}
			}
			
			// if none of nodes in elem key are selected, delete the elem key.
			for (var k in elems)
			{
				var keyLength1 = Object.keys(elems[k]).length;
				var nodeInSelection = false;
				for (var c = 0; c < keyLength1; c++)
				{			
					if (selectedNodes.indexOf(elems[k][c].node) !== -1)
					{					
						nodeInSelection = true; break;
					}			
				}
				if (nodeInSelection == false)
				{
					delete elems[k]; 
				}
			}
			
			// if nodes with same element also share the same column, only keep the first node
			for (var k in elems)
			{
				var keyLength2 = Object.keys(elems[k]).length;
				if (keyLength2 > 1)
				{
					var excludeList = [];
					for (var c = 0; c < keyLength2 -1; c++)
					{
						if (elems[k][c].col == elems[k][c+1].col)
						{
							excludeList.push(elems[k][c+1])
						}					
					}
					for (var e = 0; e < excludeList.length; e++)
					{
						delete excludeList[e];
					}					
				}
			}
			return elems;
		}

		
		this.getExposedCelList = function(elems)
		{			
			var firstFrame = 1;
			var lastFrame = frame.numberOf();
			
			for (var elemId in elems)
			{
				var exposedCels = [];
				var drawColumn = elems[elemId][0].col;
				for (var idx = 0; idx < Object.keys(elems[elemId]).length; idx++)
				{
					for (var curFrame = firstFrame; curFrame <= lastFrame; curFrame++)
					{
						var curCelName = column.getEntry (elems[elemId][idx].col, 1, curFrame);
						if (curCelName !== "" && exposedCels.indexOf(curCelName) == -1)
						{
							exposedCels.push(curCelName);
						}
					}
				}
				this.deleteCels(exposedCels, drawColumn);
			}
		}

		// finally delete unexposed cels
		this.deleteCels = function(exposedCels, drawColumn)
		{	
			// expose unexposed cels at the end frame one by one and then delete
			var lastFrame = frame.numberOf();
			var lastCel = column.getEntry (drawColumn, 1, lastFrame);
			var allCels = column.getDrawingTimings(drawColumn);			
			for (var idx2 = 0; idx2 < allCels.length; idx2++)
			{		
				if (exposedCels.indexOf(allCels[idx2]) == -1)
				{
					column.setEntry (drawColumn, 1, lastFrame, allCels[idx2]);
					column.deleteDrawingAt(drawColumn, lastFrame);
				}
			}
			column.setEntry (drawColumn, 1, lastFrame, lastCel);		
		}		
	}
}